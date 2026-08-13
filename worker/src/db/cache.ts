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
    throw new Error("Failed to retrieve newly saved AI content from D1");
  }

  return saved;
}
