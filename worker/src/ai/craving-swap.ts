/**
 * Handler for Healthy Craving Swap Generator (/api/ai/craving-swap)
 */

import { AIProviderManager } from "./provider-manager";
import { CravingSwapResult } from "./schemas";
import { sanitizeTextInput } from "../utils/validation";
import { jsonResponse, errorResponse } from "../utils/response";

export async function handleCravingSwap(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed. Use POST.", 405);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const rawCraving = sanitizeTextInput(body.craving || "", 200);
  if (!rawCraving) {
    return errorResponse("Please provide a craving name (e.g. 'Potato Chips', 'Boba Tea', 'Fried Chicken').", 400);
  }

  const normalizedCraving = rawCraving.trim().toLowerCase();
  const userPrompt = `I am craving "${rawCraving}". Suggest 2-3 healthy, nutritious alternatives that satisfy this craving with fewer calories.`;

  const systemPrompt = `You are HealthFood AI Craving Swap Assistant.
Suggest 2 to 3 nutrient-dense, lower-calorie food alternatives for the user's food craving.

Output ONLY valid raw JSON with NO markdown formatting, NO triple backticks:
{
  "craving": "${rawCraving}",
  "swaps": [
    {
      "name": "Roasted Makhana (Fox Nuts)",
      "reason": "Light, crunchy snack high in antioxidants with 70% fewer calories than fried potato chips.",
      "estimatedCaloriesSavePercent": 70
    },
    {
      "name": "Air-Fried Chickpeas",
      "reason": "High in dietary fiber and plant protein for sustained satiety.",
      "estimatedCaloriesSavePercent": 60
    }
  ]
}`;

  try {
    const aiManager = new AIProviderManager(env);
    const aiResponse = await aiManager.generateText(userPrompt, systemPrompt);

    let cleanJsonText = aiResponse.content.trim();
    if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsed: CravingSwapResult;
    try {
      parsed = JSON.parse(cleanJsonText);
    } catch {
      parsed = {
        craving: rawCraving,
        swaps: [
          {
            name: "Fresh Fruit Bowl",
            reason: "Provides natural sweetness, water content, and dietary fiber.",
            estimatedCaloriesSavePercent: 50
          }
        ]
      };
    }

    return jsonResponse({
      success: true,
      result: parsed,
      normalizedQuery: normalizedCraving,
      provider: aiResponse.modelProvider,
      model: aiResponse.modelName
    });
  } catch (err: any) {
    console.error("[CravingSwap] AI Provider Error:", err);
    return errorResponse("Failed to generate craving swaps. Please try again.", 500, err.message);
  }
}
