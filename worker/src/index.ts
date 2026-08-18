import { AIProviderManager } from "./ai/provider-manager";
import { buildFoodExplanationPrompt, buildQuestionPrompt } from "./ai/prompts";
import { validateAndNormalizeAIResponse } from "./ai/safety";
import { getCachedAIContent, saveAIContent, getCachedQuestionAnswer, saveQuestionAnswer } from "./db/cache";
import { acquireGenerationLock, releaseGenerationLock } from "./db/locks";
import { ContentType, FoodFactContext } from "./ai/types";

export interface Env {
  healthfood_db: D1Database;
  CEREBRAS_API_KEY?: string;
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

// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= limit) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

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
        return searchFoods(env, url.searchParams.get("q") || url.searchParams.get("search"));
      }

      // Food list
      if (path === "/api/foods" && request.method === "GET") {
        return getFoods(env, url);
      }

      // Food AI Content: /api/foods/:slug/ai
      const foodAiMatch = path.match(/^\/api\/foods\/([^/]+)\/ai$/);
      if (foodAiMatch && (request.method === "GET" || request.method === "POST")) {
        if (request.method === "POST") {
          const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
          if (isRateLimited(clientIp)) {
            return json(
              { success: false, error: "Rate limit exceeded. Maximum 10 AI requests per minute allowed." },
              429,
              { "Retry-After": "60" }
            );
          }
        }
        const lang = url.searchParams.get("lang") || "en";
        const contentType = (url.searchParams.get("type") || "basic") as ContentType;
        return getOrGenerateFoodAI(env, foodAiMatch[1], lang, contentType);
      }

      // Single food
      const foodMatch = path.match(/^\/api\/foods\/([^/]+)$/);
      if (foodMatch && request.method === "GET") {
        return getFood(env, foodMatch[1]);
      }

      // Custom AI Question: /api/ai/question or /api/ai/ask
      if ((path === "/api/ai/question" || path === "/api/ai/ask") && request.method === "POST") {
        const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
        if (isRateLimited(clientIp)) {
          return json(
            { success: false, error: "Rate limit exceeded. Maximum 10 AI requests per minute allowed." },
            429,
            { "Retry-After": "60" }
          );
        }
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

const CATEGORY_ICON_MAP: Record<string, string> = {
  fruits: "🍎",
  vegetables: "🥦",
  meat: "🍖",
  "fish-seafood": "🐟",
  fish: "🐟",
  seafood: "🦐",
  eggs: "🥚",
  grains: "🌾",
  legumes: "🫘",
  beans: "🫘",
  "nuts-seeds": "🥜",
  nuts: "🥜",
  dairy: "🥛",
};

function resolveCategoryIcon(slug: string, icon: string | null): string {
  if (icon && icon !== "🥦" && icon !== "🥗") return icon;
  return CATEGORY_ICON_MAP[slug.toLowerCase()] || "🥗";
}

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

  const categories = (result.results || []).map((cat: any) => ({
    ...cat,
    icon: resolveCategoryIcon(cat.slug, cat.icon),
  }));

  return json({
    success: true,
    count: categories.length,
    categories,
  });
}

const DEFAULT_FOOD_METADATA: Record<string, { image_url: string; macronutrients: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } }> = {
  // Fruits
  banana: {
    image_url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 105, protein_g: 1.3, carbs_g: 27.0, fat_g: 0.3, fiber_g: 3.1 }
  },
  apple: {
    image_url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 95, protein_g: 0.5, carbs_g: 25.0, fat_g: 0.3, fiber_g: 4.4 }
  },
  orange: {
    image_url: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 62, protein_g: 1.2, carbs_g: 15.4, fat_g: 0.2, fiber_g: 3.1 }
  },
  mango: {
    image_url: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 99, protein_g: 1.4, carbs_g: 24.7, fat_g: 0.6, fiber_g: 2.6 }
  },
  watermelon: {
    image_url: "https://images.unsplash.com/photo-1589984662646-e7b2e4962f18?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 46, protein_g: 0.9, carbs_g: 11.5, fat_g: 0.2, fiber_g: 0.6 }
  },
  grapes: {
    image_url: "https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 104, protein_g: 1.1, carbs_g: 27.3, fat_g: 0.2, fiber_g: 1.4 }
  },
  pineapple: {
    image_url: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 82, protein_g: 0.9, carbs_g: 21.6, fat_g: 0.2, fiber_g: 2.3 }
  },
  strawberry: {
    image_url: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 49, protein_g: 1.0, carbs_g: 11.7, fat_g: 0.5, fiber_g: 3.0 }
  },
  papaya: {
    image_url: "https://images.unsplash.com/photo-1617112848923-cc2234396a8d?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 59, protein_g: 0.9, carbs_g: 15.0, fat_g: 0.4, fiber_g: 2.5 }
  },
  avocado: {
    image_url: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 160, protein_g: 2.0, carbs_g: 8.5, fat_g: 14.7, fiber_g: 6.7 }
  },

  // Vegetables
  spinach: {
    image_url: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2 }
  },
  carrot: {
    image_url: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 41, protein_g: 0.9, carbs_g: 9.6, fat_g: 0.2, fiber_g: 2.8 }
  },
  broccoli: {
    image_url: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 34, protein_g: 2.8, carbs_g: 6.6, fat_g: 0.4, fiber_g: 2.6 }
  },
  tomato: {
    image_url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2 }
  },
  potato: {
    image_url: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 77, protein_g: 2.0, carbs_g: 17.5, fat_g: 0.1, fiber_g: 2.2 }
  },

  // Meat, Fish, Poultry & Eggs
  chicken: {
    image_url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 165, protein_g: 31.0, carbs_g: 0, fat_g: 3.6, fiber_g: 0 }
  },
  fish: {
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 206, protein_g: 22.0, carbs_g: 0, fat_g: 12.0, fiber_g: 0 }
  },
  salmon: {
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 280, protein_g: 34.0, carbs_g: 0, fat_g: 15.0, fiber_g: 0 }
  },
  egg: {
    image_url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 155, protein_g: 13.0, carbs_g: 1.1, fat_g: 11.0, fiber_g: 0 }
  },

  // Dairy, Grains, Legumes & Nuts
  milk: {
    image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, fiber_g: 0 }
  },
  oats: {
    image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 }
  },
  quinoa: {
    image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 222, protein_g: 8.1, carbs_g: 39.0, fat_g: 3.6, fiber_g: 5.2 }
  },
  lentils: {
    image_url: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 116, protein_g: 9.0, carbs_g: 20.0, fat_g: 0.4, fiber_g: 7.9 }
  },
  peanut: {
    image_url: "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 567, protein_g: 25.8, carbs_g: 16.1, fat_g: 49.2, fiber_g: 8.5 }
  },
  almonds: {
    image_url: "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 170, protein_g: 6.0, carbs_g: 6.0, fat_g: 14.0, fiber_g: 3.5 }
  }
};

const CATEGORY_FALLBACKS: Record<string, { image_url: string; macronutrients: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } }> = {
  fruits: {
    image_url: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 60, protein_g: 0.8, carbs_g: 14.0, fat_g: 0.2, fiber_g: 2.5 }
  },
  vegetables: {
    image_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 35, protein_g: 2.0, carbs_g: 7.0, fat_g: 0.3, fiber_g: 2.5 }
  },
  meat: {
    image_url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 180, protein_g: 26.0, carbs_g: 0, fat_g: 8.0, fiber_g: 0 }
  },
  "fish-seafood": {
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 200, protein_g: 22.0, carbs_g: 0, fat_g: 11.0, fiber_g: 0 }
  },
  eggs: {
    image_url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 155, protein_g: 13.0, carbs_g: 1.1, fat_g: 11.0, fiber_g: 0 }
  },
  dairy: {
    image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 65, protein_g: 3.5, carbs_g: 4.8, fat_g: 3.5, fiber_g: 0 }
  },
  grains: {
    image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 220, protein_g: 7.0, carbs_g: 45.0, fat_g: 1.5, fiber_g: 3.5 }
  },
  legumes: {
    image_url: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 120, protein_g: 9.0, carbs_g: 20.0, fat_g: 0.5, fiber_g: 7.5 }
  },
  "nuts-seeds": {
    image_url: "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 570, protein_g: 20.0, carbs_g: 18.0, fat_g: 50.0, fiber_g: 8.0 }
  }
};

function getRichFoodDetails(slug: string, name: string, category: string, macros: any) {
  const s = (slug || "").toLowerCase();
  const c = (category || "").toLowerCase();
  const cal = macros.calories || 100;
  const p = macros.protein_g || 1;
  const cb = macros.carbs_g || 10;
  const f = macros.fat_g || 0.5;
  const fb = macros.fiber_g || 2;

  if (s.includes("egg")) {
    return {
      summary: { calories: 155, serving_g: 100, water_g: 75.0, sugar_g: 1.1, sodium_mg: 124 },
      vitamins: [
        { name: "Vitamin A", amount: "540 IU", dv: "18%" },
        { name: "Vitamin D", amount: "82 IU", dv: "10%" },
        { name: "Vitamin B12", amount: "0.9 µg", dv: "38%" },
        { name: "Riboflavin (B2)", amount: "0.5 mg", dv: "38%" },
        { name: "Folate (B9)", amount: "47 µg", dv: "12%" }
      ],
      minerals: [
        { name: "Phosphorus", amount: "198 mg", dv: "20%" },
        { name: "Potassium", amount: "126 mg", dv: "3%" },
        { name: "Calcium", amount: "50 mg", dv: "4%" },
        { name: "Iron", amount: "1.2 mg", dv: "7%" },
        { name: "Zinc", amount: "1.1 mg", dv: "10%" },
        { name: "Selenium", amount: "30.7 µg", dv: "56%" }
      ],
      health_benefits: [
        { title: "Muscle Repair & Growth", description: "Provides complete high-quality protein containing all 9 essential amino acids for tissue repair." },
        { title: "Brain & Memory Support", description: "Rich in choline, an essential nutrient for brain development and cognitive function." },
        { title: "Eye & Vision Protection", description: "Contains lutein and zeaxanthin antioxidants that help protect retinal eye tissues." },
        { title: "Cellular & Hair Health", description: "Supports healthy skin, hair, and cell membrane structural integrity." }
      ],
      useful_for: [
        "💪 Muscle Building & Athletic Recovery",
        "🧠 Brain & Focus Support",
        "👀 Eye & Vision Protection",
        "🍳 Healthy Protein Breakfast",
        "⚖️ Weight Management & Satiety"
      ],
      things_to_know: [
        "⚠️ Contains dietary cholesterol (~186mg per large egg, mostly in yolk)",
        "⚠️ Common food allergen for sensitive individuals",
        "⚠️ Cook thoroughly to eliminate foodborne salmonella risk",
        "⚠️ Egg yolk contains almost all the fat-soluble vitamins & choline"
      ],
      suggested_portion: {
        title: "2 Large Eggs",
        grams: 100,
        calories: 155,
        macros_text: "≈ 155 kcal | 13g protein | 1.1g carbs | 11g fat"
      },
      best_ways_to_eat: [
        "Hard-boiled as a convenient portable high-protein snack",
        "Scrambled with fresh spinach, tomatoes & olive oil",
        "Poached on top of whole-grain sourdough toast",
        "Omelet packed with bell peppers & herbs"
      ],
      nutrition_score: {
        overall: "★★★★★ Outstanding",
        stars: 5,
        breakdown: { protein: 5, vitamins: 5, minerals: 5, fiber: 1, natural: 5 }
      }
    };
  }

  if (s.includes("banana")) {
    return {
      summary: { calories: 105, serving_g: 118, water_g: 75.0, sugar_g: 14.4, sodium_mg: 1 },
      vitamins: [
        { name: "Vitamin B6", amount: "0.4 mg", dv: "25%" },
        { name: "Vitamin C", amount: "10.3 mg", dv: "11%" },
        { name: "Folate (B9)", amount: "23.6 µg", dv: "6%" }
      ],
      minerals: [
        { name: "Potassium", amount: "422 mg", dv: "9%" },
        { name: "Magnesium", amount: "32 mg", dv: "8%" },
        { name: "Manganese", amount: "0.3 mg", dv: "13%" }
      ],
      health_benefits: [
        { title: "Nerve & Muscle Function", description: "Potassium regulates fluid balance, prevents muscle cramps, and supports nerve conduction." },
        { title: "Prebiotic Digestive Support", description: "Contains resistant starch and pectin that nourish beneficial probiotic gut bacteria." },
        { title: "Mood & Serotonin Synthesis", description: "High Vitamin B6 is essential for converting tryptophan into serotonin." }
      ],
      useful_for: ["🏃 Pre & Post-Workout Energy", "💪 Muscle Cramp Prevention", "🌾 Digestive & Gut Microbiome", "🍌 Quick Natural Snack"],
      things_to_know: ["⚠️ Moderation suggested for individuals on strict low-potassium renal diets", "⚠️ Riper bananas have higher sugar content and higher glycemic impact"],
      suggested_portion: { title: "1 Medium Banana", grams: 118, calories: 105, macros_text: "≈ 105 kcal | 27g carbs | 1.3g protein | 3.1g fiber" },
      best_ways_to_eat: ["Eat fresh as a portable snack", "Slice into morning oats or cereal", "Blend into high-protein smoothies"],
      nutrition_score: { overall: "★★★★☆ Good", stars: 4, breakdown: { protein: 2, vitamins: 4, minerals: 4, fiber: 4, natural: 5 } }
    };
  }

  if (s.includes("apple")) {
    return {
      summary: { calories: 95, serving_g: 182, water_g: 85.5, sugar_g: 19.0, sodium_mg: 2 },
      vitamins: [
        { name: "Vitamin C", amount: "8.4 mg", dv: "9%" },
        { name: "Vitamin K", amount: "4.0 µg", dv: "3%" }
      ],
      minerals: [
        { name: "Potassium", amount: "195 mg", dv: "4%" },
        { name: "Manganese", amount: "0.06 mg", dv: "3%" }
      ],
      health_benefits: [
        { title: "Cholesterol Regulation", description: "Soluble pectin fiber binds to dietary cholesterol, promoting healthy LDL levels." },
        { title: "Cellular Antioxidant Defense", description: "Rich in quercetin and catechin flavonoids that protect blood vessels." },
        { title: "Gut Microbiome Wellness", description: "Pectin serves as a prebiotic fuel source for colon lining cells." }
      ],
      useful_for: ["❤️ Heart Health & Cholesterol Management", "🍎 Weight Satiety & Caloric Control", "💧 Daily Hydration & Snack"],
      things_to_know: ["⚠️ Eat with skin on to consume 75% of total fiber and quercetin antioxidants", "⚠️ Wash thoroughly"],
      suggested_portion: { title: "1 Medium Apple", grams: 182, calories: 95, macros_text: "≈ 95 kcal | 25g carbs | 0.5g protein | 4.4g fiber" },
      best_ways_to_eat: ["Sliced fresh with natural peanut butter", "Diced into fresh garden salads", "Baked with cinnamon"],
      nutrition_score: { overall: "★★★★☆ Good", stars: 4, breakdown: { protein: 1, vitamins: 3, minerals: 3, fiber: 5, natural: 5 } }
    };
  }

  if (s.includes("spinach")) {
    return {
      summary: { calories: 23, serving_g: 100, water_g: 91.4, sugar_g: 0.4, sodium_mg: 79 },
      vitamins: [
        { name: "Vitamin K", amount: "483 µg", dv: "402%" },
        { name: "Vitamin A", amount: "469 µg", dv: "52%" },
        { name: "Folate (B9)", amount: "194 µg", dv: "49%" },
        { name: "Vitamin C", amount: "28.1 mg", dv: "31%" }
      ],
      minerals: [
        { name: "Iron", amount: "2.7 mg", dv: "15%" },
        { name: "Magnesium", amount: "79 mg", dv: "20%" },
        { name: "Calcium", amount: "99 mg", dv: "10%" },
        { name: "Potassium", amount: "558 mg", dv: "12%" }
      ],
      health_benefits: [
        { title: "Macular Vision Protection", description: "Exceptional lutein and zeaxanthin density protects eye retina against blue light damage." },
        { title: "Blood Cell Formation", description: "Folate and non-heme iron support healthy red blood cell production." },
        { title: "Bone Matrix Support", description: "Ultra-high Vitamin K activates osteocalcin for proper bone mineralization." }
      ],
      useful_for: ["👀 Macular Eye & Vision Protection", "🩸 Anemia & Blood Cell Formation", "🦴 Bone Density & Matrix Support"],
      things_to_know: ["⚠️ Contains oxalates; pair with Vitamin C (lemon juice) to maximize non-heme iron absorption", "⚠️ High Vitamin K"],
      suggested_portion: { title: "2 Cups Raw Spinach", grams: 100, calories: 23, macros_text: "≈ 23 kcal | 3.6g carbs | 2.9g protein | 2.2g fiber" },
      best_ways_to_eat: ["Fresh raw salad base with lemon dressing", "Sautéed lightly with garlic and olive oil", "Blended into green smoothies"],
      nutrition_score: { overall: "★★★★★ Outstanding", stars: 5, breakdown: { protein: 4, vitamins: 5, minerals: 5, fiber: 4, natural: 5 } }
    };
  }

  if (s.includes("salmon") || (s.includes("fish") && !s.includes("seafood"))) {
    return {
      summary: { calories: 206, serving_g: 100, water_g: 68.0, sugar_g: 0.0, sodium_mg: 59 },
      vitamins: [
        { name: "Vitamin B12", amount: "3.2 µg", dv: "133%" },
        { name: "Vitamin D", amount: "11 µg", dv: "55%" },
        { name: "Niacin (B3)", amount: "8.5 mg", dv: "53%" },
        { name: "Vitamin B6", amount: "0.6 mg", dv: "35%" }
      ],
      minerals: [
        { name: "Selenium", amount: "36.5 µg", dv: "66%" },
        { name: "Phosphorus", amount: "252 mg", dv: "25%" },
        { name: "Potassium", amount: "363 mg", dv: "8%" }
      ],
      health_benefits: [
        { title: "Cardiovascular Protection", description: "EPA & DHA omega-3 fatty acids lower systemic inflammation and reduce triglycerides." },
        { title: "Neurological & Cognitive Health", description: "DHA is a critical structural fatty acid in brain cell membranes and synapses." },
        { title: "Complete Protein", description: "High biological value protein supporting lean muscle tissue maintenance." }
      ],
      useful_for: ["❤️ Cardiovascular & Triglyceride Support", "🧠 Brain & Neurological Health", "💪 Lean Muscle Mass"],
      things_to_know: ["⚠️ Choose wild-caught or sustainably farmed sources", "⚠️ Rich in natural fish oils"],
      suggested_portion: { title: "1 Salmon Fillet", grams: 150, calories: 280, macros_text: "≈ 280 kcal | 34g protein | 0g carbs | 15g fat" },
      best_ways_to_eat: ["Pan-seared with lemon and herbs", "Baked in foil with asparagus", "Grilled over open flame"],
      nutrition_score: { overall: "★★★★★ Outstanding", stars: 5, breakdown: { protein: 5, vitamins: 5, minerals: 5, fiber: 1, natural: 5 } }
    };
  }

  if (s.includes("grape")) {
    return {
      summary: { calories: 69, serving_g: 100, water_g: 80.5, sugar_g: 15.5, sodium_mg: 2 },
      vitamins: [
        { name: "Vitamin C", amount: "10.8 mg", dv: "12%" },
        { name: "Vitamin K", amount: "14.6 µg", dv: "12%" },
        { name: "Vitamin B6", amount: "0.1 mg", dv: "6%" },
        { name: "Thiamine (B1)", amount: "0.07 mg", dv: "6%" }
      ],
      minerals: [
        { name: "Potassium", amount: "191 mg", dv: "4%" },
        { name: "Copper", amount: "0.13 mg", dv: "14%" },
        { name: "Manganese", amount: "0.07 mg", dv: "3%" },
        { name: "Magnesium", amount: "7 mg", dv: "2%" }
      ],
      health_benefits: [
        { title: "Cardiovascular Wellness", description: "High in resveratrol antioxidants that support optimal arterial & heart function." },
        { title: "Cellular Hydration", description: "Contains high natural water content supporting skin moisture and electrolyte balance." },
        { title: "Immune Defense", description: "Provides Vitamin C and polyphenols that defend cells against oxidative stress." }
      ],
      useful_for: [
        "💧 Cellular Hydration",
        "❤️ Heart-Conscious Eating",
        "🏃 Pre-Workout Natural Energy",
        "🍇 Anti-Aging Antioxidant Support"
      ],
      things_to_know: [
        "⚠️ Contains natural sugars; portion size matters for glycemic control",
        "⚠️ Whole grapes are preferred over grape juice to retain fiber",
        "⚠️ Wash thoroughly under cold water before consumption"
      ],
      suggested_portion: {
        title: "1 Cup Grapes",
        grams: 150,
        calories: 104,
        macros_text: "≈ 104 kcal | 27.3g carbs | 1.1g protein | 1.4g fiber"
      },
      best_ways_to_eat: [
        "Enjoy fresh as a refreshing sweet mid-day snack",
        "Freeze grapes for a delicious cold summer treat",
        "Mix into fresh fruit salads or Greek yogurt bowls",
        "Pair with walnuts or cheese for balanced blood sugar"
      ],
      nutrition_score: {
        overall: "★★★★☆ Good",
        stars: 4,
        breakdown: { protein: 2, vitamins: 4, minerals: 4, fiber: 3, natural: 5 }
      }
    };
  }

  const isFruit = c.includes("fruit") || s.includes("banana") || s.includes("apple") || s.includes("orange") || s.includes("mango") || s.includes("papaya");
  const isVeg = c.includes("veg") || s.includes("spinach") || s.includes("carrot") || s.includes("broccoli") || s.includes("tomato");
  const isMeat = c.includes("meat") || c.includes("fish") || s.includes("chicken") || s.includes("salmon");

  return {
    summary: {
      calories: cal,
      serving_g: 100,
      water_g: isFruit || isVeg ? 85.0 : 15.0,
      sugar_g: isFruit ? 14.0 : (isVeg ? 3.0 : 0.5),
      sodium_mg: isMeat ? 65 : 10
    },
    vitamins: [
      { name: "Vitamin A", amount: "350 IU", dv: "12%" },
      { name: "Vitamin C", amount: "15 mg", dv: "18%" },
      { name: "Vitamin K", amount: "22 µg", dv: "18%" },
      { name: "Folate (B9)", amount: "25 µg", dv: "6%" }
    ],
    minerals: [
      { name: "Potassium", amount: "220 mg", dv: "5%" },
      { name: "Magnesium", amount: "24 mg", dv: "6%" },
      { name: "Calcium", amount: "40 mg", dv: "3%" },
      { name: "Iron", amount: "1.5 mg", dv: "8%" }
    ],
    health_benefits: [
      { title: "Cellular Nutrition", description: "Supports overall cellular health & daily dietary micronutrient balance." },
      { title: "Metabolic Support", description: "Provides essential dietary nutrients to support active energy levels." },
      { title: "Immune Balance", description: "Contributes key vitamins and minerals to support normal immune function." },
      { title: "Digestive Wellness", description: "Provides dietary fiber and natural compounds supporting gut health." }
    ],
    useful_for: [
      "💪 General Daily Nutrition",
      "🏃 Active Lifestyle & Wellness",
      "🌿 Whole Food Plant-Based Diet",
      "❤️ Cardiovascular Health"
    ],
    things_to_know: [
      "⚠️ Portion control recommended according to daily caloric targets",
      "⚠️ Store in a cool, dry place to maintain maximum vitamin potency",
      "⚠️ Combine with complementary whole foods for balanced macronutrients"
    ],
    suggested_portion: {
      title: `1 Standard Portion (${name || 'Serving'})`,
      grams: 100,
      calories: cal,
      macros_text: `≈ ${cal} kcal | ${p}g protein | ${cb}g carbs | ${f}g fat | ${fb}g fiber`
    },
    best_ways_to_eat: [
      "Incorporate into daily balanced meals",
      "Pair with healthy fats or proteins for optimal absorption",
      "Enjoy fresh or lightly prepared to preserve nutrients"
    ],
    nutrition_score: {
      overall: "★★★★☆ Good",
      stars: 4,
      breakdown: { protein: Math.min(5, Math.ceil(p / 5) + 1), vitamins: 4, minerals: 4, fiber: Math.min(5, Math.ceil(fb * 1.5)), natural: 5 }
    }
  };
}

function enrichFoodItem(food: any) {
  const catKey = (food.category_name || '').toLowerCase().replace(/\s+/g, '-');
  const catFallback = CATEGORY_FALLBACKS[catKey] || {
    image_url: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80",
    macronutrients: { calories: 60, protein_g: 1.0, carbs_g: 12.0, fat_g: 0.3, fiber_g: 2.5 }
  };

  const meta = DEFAULT_FOOD_METADATA[food.slug?.toLowerCase()] || catFallback;
  const macros = food.macronutrients || meta.macronutrients;
  const richDetails = getRichFoodDetails(food.slug, food.name, food.category_name, macros);

  return {
    ...food,
    image_url: food.image_url || meta.image_url,
    macronutrients: macros,
    vegetarian: food.vegetarian !== undefined ? food.vegetarian : (food.food_type === 'vegetarian' || food.food_type === 'plant' || food.food_type === 'veg'),
    ...richDetails
  };
}

// ============================================================
// GET /api/foods
// ============================================================

async function getFoods(env: Env, url?: URL): Promise<Response> {
  const category = url?.searchParams.get("category") || "";
  const search = url?.searchParams.get("search") || url?.searchParams.get("q") || "";

  let query = `
    SELECT
      f.id,
      f.slug,
      f.name,
      f.scientific_name,
      f.category_id,
      c.slug AS category_slug,
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
  `;

  const bindings: any[] = [];

  if (category && category !== "all") {
    query += ` AND (LOWER(c.slug) = ? OR LOWER(c.name) LIKE ?)`;
    bindings.push(category.toLowerCase(), `%${category.toLowerCase()}%`);
  }

  if (search && search.trim() !== "") {
    const q = `%${search.trim().toLowerCase()}%`;
    query += ` AND (LOWER(f.name) LIKE ? OR LOWER(f.description) LIKE ? OR LOWER(f.slug) LIKE ? OR LOWER(c.name) LIKE ?)`;
    bindings.push(q, q, q, q);
  }

  query += ` ORDER BY c.sort_order ASC, f.name ASC`;

  let stmt = env.healthfood_db.prepare(query);
  if (bindings.length > 0) {
    stmt = stmt.bind(...bindings);
  }

  const result = await stmt.all<FoodRow>();
  const enrichedFoods = (result.results || []).map(f => enrichFoodItem(f));

  return json({
    success: true,
    count: enrichedFoods.length,
    foods: enrichedFoods,
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
    food: enrichFoodItem(food),
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
      CEREBRAS_API_KEY: env.CEREBRAS_API_KEY,
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

  // 1. Compute question hash & check D1 Database Cache
  const normalizedQuestion = question.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const questionHash = normalizedQuestion;

  const cachedQ = await getCachedQuestionAnswer(env.healthfood_db, questionHash, languageCode);
  if (cachedQ) {
    console.log(`============================================================`);
    console.log(`⚡ [D1 DB CACHE HIT] Answer served from D1 Database for: "${question.trim()}"`);
    console.log(`============================================================`);
    return json({
      success: true,
      cached: true,
      question: question.trim(),
      languageCode,
      modelProvider: cachedQ.modelProvider,
      modelName: cachedQ.modelName,
      answer: cachedQ.answer,
    });
  }

  const { prompt, systemPrompt } = buildQuestionPrompt(question.trim(), languageCode, facts);

  const manager = new AIProviderManager({
    CEREBRAS_API_KEY: env.CEREBRAS_API_KEY,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GROQ_API_KEY: env.GROQ_API_KEY,
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
  });

  try {
    const aiRawResponse = await manager.generateText(prompt, systemPrompt);
    const safeContent = validateAndNormalizeAIResponse(aiRawResponse.content, languageCode);

    // 2. Save answer to D1 Database so next time onwards it is served directly from DB
    try {
      await saveQuestionAnswer(env.healthfood_db, {
        question: question.trim(),
        questionHash,
        foodId: foodId || null,
        languageCode,
        answer: safeContent,
        modelProvider: aiRawResponse.modelProvider,
        modelName: aiRawResponse.modelName,
      });
      console.log(`💾 [D1 DB CACHE SAVED] Saved answer for question: "${question.trim()}" into D1 Database`);
    } catch (saveErr) {
      console.warn("[D1 DB Cache Save Warning]:", saveErr);
    }

    return json({
      success: true,
      cached: false,
      question: question.trim(),
      languageCode,
      modelProvider: aiRawResponse.modelProvider,
      modelName: aiRawResponse.modelName,
      answer: safeContent,
      attemptedProviders: aiRawResponse.attemptedProviders,
      rateLimitHits: aiRawResponse.rateLimitHits,
    });
  } catch (err: any) {
    console.warn("AI Question Generation Fallback:", err?.message);
    const qLower = question.trim().toLowerCase();
    let fallbackAnswer = "Hello! 👋 I'm HealthFood AI, your nutrition assistant. Ask me anything about food calories, vitamins, macros, or healthy eating goals!\n\n*Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice.*";

    if (!qLower.includes("hi") && !qLower.includes("hello") && !qLower.includes("hey")) {
      fallbackAnswer = `Here is helpful guidance regarding "${question.trim()}": Consuming a balanced diet rich in whole foods, vegetables, lean protein, and essential micronutrients supports overall metabolic health and energy.\n\n*Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice.*`;
    }

    return json({
      success: true,
      fallback: true,
      question: question.trim(),
      languageCode,
      modelProvider: "HealthFood Assistant Engine",
      modelName: "healthfood-fallback-v1",
      answer: fallbackAnswer,
    });
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
        f.image_url,
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
          OR LOWER(f.description) LIKE ?
        )
      ORDER BY f.name ASC
      LIMIT 30
      `
    )
    .bind(searchTerm, searchTerm, searchTerm, searchTerm)
    .all();

  const enrichedFoods = (result.results || []).map((f) => enrichFoodItem(f));

  return json({
    success: true,
    query: query.trim(),
    count: enrichedFoods.length,
    foods: enrichedFoods,
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

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-XSS-Protection": "1; mode=block",
      ...extraHeaders,
    },
  });
}