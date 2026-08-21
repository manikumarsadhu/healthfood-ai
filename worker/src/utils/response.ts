/**
 * Standardized Response Helpers for Cloudflare Worker Backend
 */

export function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...headers
    }
  });
}

export function errorResponse(message: string, status = 400, details?: any): Response {
  return jsonResponse(
    {
      success: false,
      error: message,
      details: details || null,
      timestamp: new Date().toISOString()
    },
    status
  );
}
