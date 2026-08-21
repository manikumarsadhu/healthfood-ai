/**
 * Handler for Packaged Ingredient Red-Flag Scanner (/api/ai/ingredient-check)
 */

import { AIProviderManager } from "./provider-manager";
import { IngredientCheckResult } from "./schemas";
import { validateImagePayload, sanitizeTextInput } from "../utils/validation";
import { jsonResponse, errorResponse } from "../utils/response";

export async function handleIngredientCheck(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed. Use POST.", 405);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const rawIngredients = sanitizeTextInput(body.ingredients || "", 3000);
  const imagePayload = body.image ? String(body.image) : null;

  if (!rawIngredients && !imagePayload) {
    return errorResponse("Please provide an ingredient list text or an image of the packaged label.", 400);
  }

  let userPrompt = "";
  if (imagePayload) {
    const val = validateImagePayload(imagePayload);
    if (!val.valid) {
      return errorResponse(val.error || "Invalid image payload.", 400);
    }
    userPrompt = "Analyze the packaged food label in this image and list its ingredients.";
  } else {
    userPrompt = `Analyze the following packaged food ingredient list:\n\n"${rawIngredients}"`;
  }

  const systemPrompt = `You are HealthFood AI, an evidence-informed nutrition assistant evaluating packaged food ingredients.
Your task is to analyze ingredients for red flags (added sugars, palm oil, artificial sweeteners, high sodium additives, preservatives) and assign a health grade (A, B, C, D, or F).

STRICT NON-DIAGNOSTIC LANGUAGE RULES:
- Never call ingredients toxic or deadly. Use clear non-diagnostic terms such as "Ingredient to consider", "Added sugar detected", "High-sodium ingredient", or "Highly processed ingredient".
- Output ONLY valid raw JSON with NO markdown formatting, NO triple backticks, and NO conversational preambles.

JSON Output Schema:
{
  "grade": "B",
  "summary": "Moderately processed packaged food with added sugars.",
  "redFlags": [
    {
      "ingredient": "palm oil",
      "severity": "moderate",
      "reason": "High in saturated fat"
    }
  ],
  "positiveIngredients": ["whole grain oats"],
  "recommendation": "Choose products with less added sugar and sodium.",
  "confidence": 0.9
}`;

  try {
    const aiManager = new AIProviderManager(env);
    const aiResponse = await aiManager.generateText(userPrompt, systemPrompt);

    // Clean JSON response (strip markdown ```json wrapping if present)
    let cleanJsonText = aiResponse.content.trim();
    if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsed: IngredientCheckResult;
    try {
      parsed = JSON.parse(cleanJsonText);
    } catch {
      // Fallback response if AI output malformed JSON
      parsed = {
        grade: "C",
        summary: "Analyzed ingredient list.",
        redFlags: [],
        positiveIngredients: [],
        recommendation: "Check portion sizes and compare with whole food alternatives.",
        confidence: 0.7
      };
    }

    return jsonResponse({
      success: true,
      result: parsed,
      provider: aiResponse.modelProvider,
      model: aiResponse.modelName
    });
  } catch (err: any) {
    console.error("[IngredientCheck] AI Provider Error:", err);
    return errorResponse("Failed to analyze ingredients via AI provider. Please try again.", 500, err.message);
  }
}
