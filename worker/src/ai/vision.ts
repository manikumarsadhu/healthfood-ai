/**
 * Handler for Vision AI Photo Analyzer (/api/ai/vision)
 * Implements the Golden Rule: AI identifies -> D1 verifies -> calculator computes -> frontend renders.
 */

import { AIProviderManager } from "./provider-manager";
import { VisionDetectionResult } from "./schemas";
import { matchFoodInD1, calculateScaledNutritionFromD1 } from "../nutrition/food-matcher";
import { validateImagePayload } from "../utils/validation";
import { jsonResponse, errorResponse } from "../utils/response";

export async function handleVisionAnalysis(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed. Use POST.", 405);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const imagePayload = body.image ? String(body.image) : null;
  if (!imagePayload) {
    return errorResponse("Please provide an image payload for visual food analysis.", 400);
  }

  const val = validateImagePayload(imagePayload);
  if (!val.valid) {
    return errorResponse(val.error || "Invalid image payload.", 400);
  }

  const userPrompt = "Identify all food items in this meal image and estimate their weight in grams.";
  const systemPrompt = `You are HealthFood AI Vision Assistant.
Your task is ONLY to identify food items present in the meal photo and visually estimate their portion weight in grams.

CRITICAL ARCHITECTURAL RULE:
- DO NOT invent, generate, or guess any numerical calories, protein, fat, or carb values.
- ONLY return detected food names, estimated weight in grams, and confidence score.

Output ONLY valid raw JSON with NO markdown formatting, NO triple backticks:
{
  "foods": [
    { "detectedName": "banana", "estimatedGrams": 118, "confidence": 0.92 },
    { "detectedName": "cooked rice", "estimatedGrams": 150, "confidence": 0.85 }
  ],
  "notes": "Portion sizes are visual estimates."
}`;

  try {
    const aiManager = new AIProviderManager(env);
    // Invoke vision analysis
    const aiResponse = await aiManager.generateText(userPrompt, systemPrompt);

    let cleanJsonText = aiResponse.content.trim();
    if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    let rawDetection: VisionDetectionResult;
    try {
      rawDetection = JSON.parse(cleanJsonText);
    } catch {
      rawDetection = { foods: [], notes: "Could not visually identify food items clearly." };
    }

    const detectedFoods = Array.isArray(rawDetection.foods) ? rawDetection.foods : [];
    const processedFoods = [];
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

    for (const item of detectedFoods) {
      if (!item.detectedName) continue;

      const matched = await matchFoodInD1(item.detectedName, env.healthfood_db);
      const estGrams = item.estimatedGrams || 100;

      if (matched) {
        const scaled = calculateScaledNutritionFromD1(matched.macronutrients, estGrams);
        
        totals.calories += scaled.calories;
        totals.protein = Number((totals.protein + scaled.protein).toFixed(1));
        totals.carbs = Number((totals.carbs + scaled.carbs).toFixed(1));
        totals.fat = Number((totals.fat + scaled.fat).toFixed(1));
        totals.fiber = Number((totals.fiber + scaled.fiber).toFixed(1));

        processedFoods.push({
          detectedName: item.detectedName,
          matchedFoodId: matched.slug,
          displayName: matched.displayName,
          estimatedGrams: estGrams,
          confidence: item.confidence || 0.8,
          nutrition: scaled
        });
      } else {
        // Fallback for un-matched items: return matchedFoodId = null so client doesn't guess
        processedFoods.push({
          detectedName: item.detectedName,
          matchedFoodId: null,
          displayName: item.detectedName,
          estimatedGrams: estGrams,
          confidence: item.confidence || 0.5,
          nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        });
      }
    }

    return jsonResponse({
      success: true,
      foods: processedFoods,
      totals,
      notes: rawDetection.notes || "Nutrition values computed strictly from verified D1 database.",
      provider: aiResponse.modelProvider,
      model: aiResponse.modelName
    });
  } catch (err: any) {
    console.error("[VisionAnalysis] AI Provider Error:", err);
    return errorResponse("Failed to analyze meal image. Please try again.", 500, err.message);
  }
}
