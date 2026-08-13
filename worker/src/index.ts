import { AIProviderManager } from "./ai/provider-manager";
import { buildFoodExplanationPrompt, buildQuestionPrompt } from "./ai/prompts";
import { validateAndNormalizeAIResponse } from "./ai/safety";
import { getCachedAIContent, saveAIContent } from "./db/cache";
import { acquireGenerationLock, releaseGenerationLock } from "./db/locks";
import { ContentType, FoodFactContext } from "./ai/types";

export interface Env {
  healthfood_db: D1Database;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

type FoodRow = {
  id: number;
  slug: string;
  name: string;
  scientific_name: string | null;
  category_id: number;
  category_name: string;
  food_type: string;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  serving_size_g: number | null;
};

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === "/api/health") {
        return json({
          success: true,
          service: "healthfood-api",
          database: "connected",
          timestamp: new Date().toISOString(),
        });
      }

      // Daily tip
      if (path === "/api/daily-tip" && request.method === "GET") {
        const lang = url.searchParams.get("lang") || "en";
        return getDailyTip(env, lang);
      }

      // App Config
      if (path === "/api/config" && request.method === "GET") {
        return getAppConfig(env);
      }

      // Categories
      if (path === "/api/categories" && request.method === "GET") {
        return getCategories(env);
      }

      // Search
      if (path === "/api/search" && request.method === "GET") {
        return searchFoods(env, url.searchParams.get("q"));
      }

      // Food list
      if (path === "/api/foods" && request.method === "GET") {
        return getFoods(env);
      }

      // Food AI Content: /api/foods/:slug/ai
      const foodAiMatch = path.match(/^\/api\/foods\/([^/]+)\/ai$/);
      if (foodAiMatch && (request.method === "GET" || request.method === "POST")) {
        const lang = url.searchParams.get("lang") || "en";
        const contentType = (url.searchParams.get("type") || "basic") as ContentType;
        return getOrGenerateFoodAI(env, foodAiMatch[1], lang, contentType);
      }

      // Single food
      const foodMatch = path.match(/^\/api\/foods\/([^/]+)$/);
      if (foodMatch && request.method === "GET") {
        return getFood(env, foodMatch[1]);
      }

      // Custom AI Question: /api/ai/question
      if (path === "/api/ai/question" && request.method === "POST") {
        return handleAIQuestion(request, env);
      }

      return json(
        {
          success: false,
          error: "Endpoint not found",
        },
        404
      );
    } catch (error: any) {
      console.error("Unhandled Worker Error:", error);

      return json(
        {
          success: false,
          error: error?.message || "Internal server error",
        },
        500
      );
    }
  },
};

// ============================================================
// GET /api/categories
// ============================================================

async function getCategories(env: Env): Promise<Response> {
  const result = await env.healthfood_db
    .prepare(
      `
      SELECT
        id,
        slug,
        name,
        description,
        icon,
        sort_order
      FROM categories
      WHERE is_active = 1
      ORDER BY sort_order ASC
      `
    )
    .all();

  return json({
    success: true,
    count: result.results.length,
    categories: result.results,
  });
}

// ============================================================
// GET /api/foods
// ============================================================

async function getFoods(env: Env): Promise<Response> {
  const result = await env.healthfood_db
    .prepare(
      `
      SELECT
        f.id,
        f.slug,
        f.name,
        f.scientific_name,
        f.category_id,
        c.name AS category_name,
        f.food_type,
        f.description,
        f.image_url,
        f.thumbnail_url,
        f.serving_size_g
      FROM foods f
      INNER JOIN categories c
        ON c.id = f.category_id
      WHERE f.is_active = 1
      ORDER BY c.sort_order ASC, f.name ASC
      `
    )
    .all<FoodRow>();

  return json({
    success: true,
    count: result.results.length,
    foods: result.results,
  });
}

// ============================================================
// GET /api/foods/:slug
// ============================================================

async function getFood(env: Env, slug: string): Promise<Response> {
  const food = await env.healthfood_db
    .prepare(
      `
      SELECT
        f.id,
        f.slug,
        f.name,
        f.scientific_name,
        f.category_id,
        c.name AS category_name,
        f.food_type,
        f.description,
        f.image_url,
        f.thumbnail_url,
        f.serving_size_g
      FROM foods f
      INNER JOIN categories c
        ON c.id = f.category_id
      WHERE f.slug = ?
        AND f.is_active = 1
      LIMIT 1
      `
    )
    .bind(slug.toLowerCase())
    .first<FoodRow>();

  if (!food) {
    return json(
      {
        success: false,
        error: "Food not found",
      },
      404
    );
  }

  // Nutrition
  const nutrition = await env.healthfood_db
    .prepare(
      `
      SELECT
        n.slug,
        n.name,
        n.nutrient_group,
        fn.amount,
        fn.unit,
        fn.basis_g
      FROM food_nutrients fn
      INNER JOIN nutrients n
        ON n.id = fn.nutrient_id
      WHERE fn.food_id = ?
      ORDER BY n.sort_order ASC
      `
    )
    .bind(food.id)
    .all();

  // Health support
  const healthSupport = await env.healthfood_db
    .prepare(
      `
      SELECT
        ht.slug,
        ht.name,
        fht.relationship,
        fht.evidence_note
      FROM food_health_topics fht
      INNER JOIN health_topics ht
        ON ht.id = fht.health_topic_id
      WHERE fht.food_id = ?
      ORDER BY ht.name ASC
      `
    )
    .bind(food.id)
    .all();

  // Cached AI content
  const aiContent = await env.healthfood_db
    .prepare(
      `
      SELECT
        language_code,
        content_type,
        content,
        model_provider,
        model_name,
        generated_at,
        updated_at
      FROM ai_content
      WHERE food_id = ?
        AND status = 'published'
      ORDER BY language_code, content_type
      `
    )
    .bind(food.id)
    .all();

  return json({
    success: true,
    food,
    nutrition: nutrition.results,
    healthSupport: healthSupport.results,
    aiContent: aiContent.results,
  });
}

// ============================================================
// GET or POST /api/foods/:slug/ai?lang=en&type=basic
// ============================================================

async function getOrGenerateFoodAI(
  env: Env,
  slug: string,
  languageCode: string,
  contentType: ContentType
): Promise<Response> {
  const food = await env.healthfood_db
    .prepare(
      `
      SELECT
        f.id,
        f.slug,
        f.name,
        f.scientific_name,
        f.category_id,
        c.name AS category_name,
        f.food_type,
        f.description,
        f.image_url,
        f.thumbnail_url,
        f.serving_size_g
      FROM foods f
      INNER JOIN categories c
        ON c.id = f.category_id
      WHERE f.slug = ?
        AND f.is_active = 1
      LIMIT 1
      `
    )
    .bind(slug.toLowerCase())
    .first<FoodRow>();

  if (!food) {
    return json({ success: false, error: "Food not found" }, 404);
  }

  // 1. Check D1 Cache
  const cached = await getCachedAIContent(
    env.healthfood_db,
    food.id,
    languageCode,
    contentType
  );

  if (cached) {
    return json({
      success: true,
      cached: true,
      foodId: food.id,
      slug: food.slug,
      languageCode: cached.language_code,
      contentType: cached.content_type,
      modelProvider: cached.model_provider,
      modelName: cached.model_name,
      content: cached.content,
      generatedAt: cached.generated_at,
    });
  }

  // 2. Acquire Generation Lock
  const locked = await acquireGenerationLock(
    env.healthfood_db,
    food.id,
    languageCode,
    contentType
  );

  if (!locked) {
    return json(
      {
        success: false,
        error: "Generation currently in progress for this request. Please retry in a moment.",
      },
      429
    );
  }

  try {
    // 3. Load facts context for accurate AI response
    const nutrientsResult = await env.healthfood_db
      .prepare(
        `
        SELECT n.name, fn.amount, fn.unit
        FROM food_nutrients fn
        INNER JOIN nutrients n ON n.id = fn.nutrient_id
        WHERE fn.food_id = ?
        ORDER BY n.sort_order ASC
        `
      )
      .bind(food.id)
      .all<{ name: string; amount: number; unit: string }>();

    const healthTopicsResult = await env.healthfood_db
      .prepare(
        `
        SELECT ht.name, fht.relationship, fht.evidence_note
        FROM food_health_topics fht
        INNER JOIN health_topics ht ON ht.id = fht.health_topic_id
        WHERE fht.food_id = ?
        `
      )
      .bind(food.id)
      .all<{ name: string; relationship: string; evidenceNote?: string }>();

    const facts: FoodFactContext = {
      foodName: food.name,
      categoryName: food.category_name,
      foodType: food.food_type,
      servingSizeG: food.serving_size_g,
      description: food.description,
      nutrients: nutrientsResult.results,
      healthTopics: healthTopicsResult.results,
    };

    // Build prompt & system prompt
    const { prompt, systemPrompt } = buildFoodExplanationPrompt(
      facts,
      contentType,
      languageCode
    );

    // 4. Execute AI provider manager with multi-provider rate limit fallback loop
    const manager = new AIProviderManager({
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GROQ_API_KEY: env.GROQ_API_KEY,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    });

    const aiRawResponse = await manager.generateText(prompt, systemPrompt);

    // 5. Validate & Normalize
    const safeContent = validateAndNormalizeAIResponse(
      aiRawResponse.content,
      languageCode
    );

    // 6. Save to D1 Cache
    const saved = await saveAIContent(env.healthfood_db, {
      foodId: food.id,
      languageCode,
      contentType,
      modelProvider: aiRawResponse.modelProvider,
      modelName: aiRawResponse.modelName,
      content: safeContent,
    });

    return json({
      success: true,
      cached: false,
      foodId: food.id,
      slug: food.slug,
      languageCode: saved.language_code,
      contentType: saved.content_type,
      modelProvider: saved.model_provider,
      modelName: saved.model_name,
      content: saved.content,
      generatedAt: saved.generated_at,
      attemptedProviders: aiRawResponse.attemptedProviders,
      rateLimitHits: aiRawResponse.rateLimitHits,
    });
  } catch (err: any) {
    console.error("AI Generation Error:", err);
    return json({ success: false, error: err.message || "Failed to generate AI content" }, 500);
  } finally {
    await releaseGenerationLock(
      env.healthfood_db,
      food.id,
      languageCode,
      contentType
    );
  }
}

// ============================================================
// POST /api/ai/question
// ============================================================

async function handleAIQuestion(request: Request, env: Env): Promise<Response> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10240) {
    return json({ success: false, error: "Payload exceeds maximum allowed size of 10KB" }, 413);
  }

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { question, foodId, languageCode = "en" } = body || {};
  if (!question || typeof question !== "string" || question.trim().length < 3) {
    return json({ success: false, error: "Question must be at least 3 characters long" }, 400);
  }

  if (question.trim().length > 500) {
    return json({ success: false, error: "Question exceeds maximum limit of 500 characters" }, 400);
  }

  let facts: FoodFactContext | undefined;
  if (foodId && typeof foodId === "number") {
    const food = await env.healthfood_db
      .prepare("SELECT f.name, c.name as category_name FROM foods f JOIN categories c ON c.id = f.category_id WHERE f.id = ?")
      .bind(foodId)
      .first<{ name: string; category_name: string }>();

    if (food) {
      facts = { foodName: food.name, categoryName: food.category_name };
    }
  }

  const { prompt, systemPrompt } = buildQuestionPrompt(question.trim(), languageCode, facts);

  const manager = new AIProviderManager({
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GROQ_API_KEY: env.GROQ_API_KEY,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
  });

  try {
    const aiRawResponse = await manager.generateText(prompt, systemPrompt);
    const safeContent = validateAndNormalizeAIResponse(aiRawResponse.content, languageCode);

    return json({
      success: true,
      question: question.trim(),
      languageCode,
      modelProvider: aiRawResponse.modelProvider,
      modelName: aiRawResponse.modelName,
      answer: safeContent,
      attemptedProviders: aiRawResponse.attemptedProviders,
      rateLimitHits: aiRawResponse.rateLimitHits,
    });
  } catch (err: any) {
    return json({ success: false, error: err.message || "Failed to answer question" }, 500);
  }
}

// ============================================================
// GET /api/search?q=banana
// ============================================================

async function searchFoods(
  env: Env,
  query: string | null
): Promise<Response> {
  if (!query || query.trim().length < 2) {
    return json(
      {
        success: false,
        error: "Search query must contain at least 2 characters",
      },
      400
    );
  }

  const searchTerm = `%${query.trim().toLowerCase()}%`;

  const result = await env.healthfood_db
    .prepare(
      `
      SELECT DISTINCT
        f.id,
        f.slug,
        f.name,
        f.category_id,
        c.name AS category_name,
        f.food_type,
        f.description,
        f.thumbnail_url
      FROM foods f
      INNER JOIN categories c
        ON c.id = f.category_id
      LEFT JOIN food_aliases fa
        ON fa.food_id = f.id
      WHERE f.is_active = 1
        AND (
          LOWER(f.name) LIKE ?
          OR LOWER(f.slug) LIKE ?
          OR LOWER(fa.alias) LIKE ?
        )
      ORDER BY f.name ASC
      LIMIT 30
      `
    )
    .bind(searchTerm, searchTerm, searchTerm)
    .all();

  return json({
    success: true,
    query: query.trim(),
    count: result.results.length,
    foods: result.results,
  });
}

// ============================================================
// GET /api/daily-tip
// ============================================================

async function getDailyTip(env: Env, languageCode = "en"): Promise<Response> {
  const todayStr = new Date().toISOString().split("T")[0];

  const item = await env.healthfood_db
    .prepare(
      `
      SELECT
        di.id,
        di.title,
        di.message,
        di.scheduled_date,
        f.id AS food_id,
        f.slug AS food_slug,
        f.name AS food_name,
        f.image_url,
        f.thumbnail_url
      FROM daily_items di
      INNER JOIN foods f ON f.id = di.food_id
      WHERE di.scheduled_date <= ?
        AND di.language_code = ?
        AND di.is_published = 1
      ORDER BY di.scheduled_date DESC
      LIMIT 1
      `
    )
    .bind(todayStr, languageCode)
    .first<any>();

  if (item) {
    return json({
      success: true,
      tip: {
        id: item.id,
        title: item.title,
        message: item.message,
        scheduledDate: item.scheduled_date,
        food: {
          id: item.food_id,
          slug: item.food_slug,
          name: item.food_name,
          imageUrl: item.image_url,
          thumbnailUrl: item.thumbnail_url,
        },
      },
    });
  }

  // Fallback: Pick food based on day of year
  const foodCountResult = await env.healthfood_db
    .prepare("SELECT COUNT(*) as count FROM foods WHERE is_active = 1")
    .first<{ count: number }>();

  const totalFoods = foodCountResult?.count || 1;
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const offset = dayOfYear % totalFoods;

  const fallbackFood = await env.healthfood_db
    .prepare(
      `
      SELECT f.id, f.slug, f.name, f.description, f.image_url, f.thumbnail_url, c.name AS category_name
      FROM foods f
      INNER JOIN categories c ON c.id = f.category_id
      WHERE f.is_active = 1
      ORDER BY f.id ASC
      LIMIT 1 OFFSET ?
      `
    )
    .bind(offset)
    .first<any>();

  if (fallbackFood) {
    return json({
      success: true,
      tip: {
        id: 0,
        title: `Today's Food Spotlight: ${fallbackFood.name}`,
        message:
          fallbackFood.description ||
          `Discover the nutrition facts and health benefits of ${fallbackFood.name}.`,
        scheduledDate: todayStr,
        food: {
          id: fallbackFood.id,
          slug: fallbackFood.slug,
          name: fallbackFood.name,
          imageUrl: fallbackFood.image_url,
          thumbnailUrl: fallbackFood.thumbnail_url,
        },
      },
    });
  }

  return json({ success: false, error: "No daily tip available" }, 404);
}

// ============================================================
// GET /api/config
// ============================================================

async function getAppConfig(env: Env): Promise<Response> {
  const dbConfigs = await env.healthfood_db
    .prepare("SELECT config_key, config_value FROM app_config")
    .all<{ config_key: string; config_value: string }>();

  const configMap: Record<string, string> = {};
  if (dbConfigs?.results) {
    for (const row of dbConfigs.results) {
      configMap[row.config_key] = row.config_value;
    }
  }

  return json({
    success: true,
    version: "1.0.0",
    appName: "HealthFood AI",
    disclaimer:
      "Information is for educational purposes and is not a substitute for professional medical advice.",
    supportedLanguages: [
      { code: "en", name: "English" },
      { code: "te", name: "Telugu (తెలుగు)" },
      { code: "hi", name: "Hindi (हिंदी)" },
    ],
    supportedContentTypes: [
      "basic",
      "detailed",
      "vitamins",
      "minerals",
      "health_support",
      "meal_ideas",
    ],
    config: configMap,
  });
}

// ============================================================
// JSON RESPONSE
// ============================================================

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}