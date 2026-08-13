export function makeCacheKey(
  foodId: number,
  languageCode: string,
  contentType: string,
  promptVersion = "v1"
): string {
  return `food:${foodId}:lang:${languageCode}:type:${contentType}:v:${promptVersion}`;
}

export async function acquireGenerationLock(
  db: D1Database,
  foodId: number,
  languageCode: string,
  contentType: string,
  promptVersion = "v1",
  lockTtlSeconds = 30
): Promise<boolean> {
  const key = makeCacheKey(foodId, languageCode, contentType, promptVersion);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockTtlSeconds * 1000).toISOString();

  // Clean expired locks
  await db
    .prepare("DELETE FROM generation_locks WHERE expires_at < ?")
    .bind(now.toISOString())
    .run();

  try {
    await db
      .prepare(
        `
        INSERT INTO generation_locks (
          cache_key,
          food_id,
          language_code,
          content_type,
          prompt_version,
          locked_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        key,
        foodId,
        languageCode,
        contentType,
        promptVersion,
        now.toISOString(),
        expiresAt
      )
      .run();

    return true;
  } catch (err) {
    // Unique constraint error means lock is currently held
    return false;
  }
}

export async function releaseGenerationLock(
  db: D1Database,
  foodId: number,
  languageCode: string,
  contentType: string,
  promptVersion = "v1"
): Promise<void> {
  const key = makeCacheKey(foodId, languageCode, contentType, promptVersion);
  await db
    .prepare("DELETE FROM generation_locks WHERE cache_key = ?")
    .bind(key)
    .run();
}
