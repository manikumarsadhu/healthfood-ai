export interface CachedAIContent {
  id: number;
  food_id: number;
  language_code: string;
  content_type: string;
  prompt_version: string;
  model_provider: string;
  model_name: string;
  content: string;
  status: string;
  generated_at: string;
  updated_at: string;
}

export async function getCachedAIContent(
  db: D1Database,
  foodId: number,
  languageCode: string,
  contentType: string,
  promptVersion = "v1"
): Promise<CachedAIContent | null> {
  const row = await db
    .prepare(
      `
      SELECT
        id,
        food_id,
        language_code,
        content_type,
        prompt_version,
        model_provider,
        model_name,
        content,
        status,
        generated_at,
        updated_at
      FROM ai_content
      WHERE food_id = ?
        AND language_code = ?
        AND content_type = ?
        AND prompt_version = ?
        AND status = 'published'
      LIMIT 1
      `
    )
    .bind(foodId, languageCode, contentType, promptVersion)
    .first<CachedAIContent>();

  return row || null;
}

export async function saveAIContent(
  db: D1Database,
  data: {
    foodId: number;
    languageCode: string;
    contentType: string;
    promptVersion?: string;
    modelProvider: string;
    modelName: string;
    content: string;
  }
): Promise<CachedAIContent> {
  const promptVersion = data.promptVersion || "v1";
  const now = new Date().toISOString();

  await db
    .prepare(
      `
      INSERT INTO ai_content (
        food_id,
        language_code,
        content_type,
        prompt_version,
        model_provider,
        model_name,
        content,
        status,
        generated_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
      ON CONFLICT(food_id, language_code, content_type, prompt_version) DO UPDATE SET
        model_provider = excluded.model_provider,
        model_name = excluded.model_name,
        content = excluded.content,
        status = 'published',
        updated_at = excluded.updated_at
      `
    )
    .bind(
      data.foodId,
      data.languageCode,
      data.contentType,
      promptVersion,
      data.modelProvider,
      data.modelName,
      data.content,
      now,
      now
    )
    .run();

  const saved = await getCachedAIContent(
    db,
    data.foodId,
    data.languageCode,
    data.contentType,
    promptVersion
  );

  if (!saved) {
    throw new Error("Failed to save or retrieve cached AI content");
  }

  return saved;
}

export async function getCachedQuestionAnswer(
  db: D1Database,
  questionHash: string,
  languageCode = "en"
): Promise<{ answer: string; modelProvider: string; modelName: string } | null> {
  try {
    const row = await db
      .prepare(
        `
        SELECT c.content AS answer, c.model_provider, c.model_name
        FROM ai_questions q
        JOIN ai_content c ON c.id = q.answer_content_id
        WHERE q.question_hash = ? AND q.language_code = ?
        ORDER BY q.id DESC
        LIMIT 1
        `
      )
      .bind(questionHash, languageCode)
      .first<{ answer: string; model_provider: string; model_name: string }>();

    if (!row) return null;
    return {
      answer: row.answer,
      modelProvider: row.model_provider,
      modelName: row.model_name
    };
  } catch (e) {
    return null;
  }
}

export async function saveQuestionAnswer(
  db: D1Database,
  data: {
    question: string;
    questionHash: string;
    foodId?: number | null;
    languageCode: string;
    answer: string;
    modelProvider: string;
    modelName: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Insert into ai_content
  const res = await db
    .prepare(
      `
      INSERT INTO ai_content (
        food_id,
        language_code,
        content_type,
        prompt_version,
        model_provider,
        model_name,
        content,
        status,
        generated_at,
        updated_at
      ) VALUES (?, ?, 'qa', 'v1', ?, ?, ?, 'published', ?, ?)
      `
    )
    .bind(
      data.foodId || null,
      data.languageCode,
      data.modelProvider,
      data.modelName,
      data.answer,
      now,
      now
    )
    .run();

  const contentId = res.meta?.last_row_id;

  // 2. Insert into ai_questions
  await db
    .prepare(
      `
      INSERT INTO ai_questions (
        food_id,
        language_code,
        question,
        question_hash,
        answer_content_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      data.foodId || null,
      data.languageCode,
      data.question,
      data.questionHash,
      contentId || null,
      now
    )
    .run();
}
