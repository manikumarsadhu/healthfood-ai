/**
 * Validation and Security Helpers for Cloudflare Worker Backend
 */

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: string;
  cleanBase64?: string;
  error?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1 MB

/**
 * Validates base64 image payload (size <= 1MB, allowed MIME type)
 */
export function validateImagePayload(payload: string): ImageValidationResult {
  if (!payload || typeof payload !== "string") {
    return { valid: false, error: "Image payload is missing or invalid." };
  }

  let mimeType = "image/jpeg";
  let cleanBase64 = payload.trim();

  // Handle data URL prefix: data:image/png;base64,iVBORw...
  if (cleanBase64.startsWith("data:")) {
    const parts = cleanBase64.split(";base64,");
    if (parts.length !== 2) {
      return { valid: false, error: "Malformed data URI image string." };
    }
    mimeType = parts[0].replace("data:", "").toLowerCase();
    cleanBase64 = parts[1];
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: `Unsupported image format (${mimeType}). Please upload JPEG, PNG, or WebP.`
    };
  }

  // Calculate approximate decoded size in bytes: (len * 3) / 4 - padding
  const paddingCount = (cleanBase64.match(/=/g) || []).length;
  const estimatedBytes = Math.floor((cleanBase64.length * 3) / 4) - paddingCount;

  if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image file size (${(estimatedBytes / 1024 / 1024).toFixed(2)}MB) exceeds the 1MB limit. Please compress the image.`
    };
  }

  return {
    valid: true,
    mimeType,
    cleanBase64
  };
}

/**
 * Sanitize text input string
 */
export function sanitizeTextInput(input: string, maxLen = 3000): string {
  if (!input || typeof input !== "string") return "";
  return input.trim().slice(0, maxLen);
}
