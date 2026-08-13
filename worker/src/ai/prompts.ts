import { FoodFactContext, SupportedLanguage, ContentType } from "./types";

export const SYSTEM_PROMPT = `You are HealthFood AI, a friendly, accurate nutrition and food-health assistant.
RULES:
1. Provide educational nutrition knowledge ONLY.
2. DO NOT make medical diagnoses, promise disease cures, or offer individual medical treatments.
3. Keep verified numerical facts (calories, grams, milligrams) strictly accurate as provided in the prompt facts context.
4. Always adopt a polite, encouraging, and clear tone suitable for general users.
5. Provide response in Markdown format.`;

export function buildFoodExplanationPrompt(
  facts: FoodFactContext,
  contentType: ContentType,
  languageCode: SupportedLanguage
): { prompt: string; systemPrompt: string } {
  const languageNames: Record<string, string> = {
    en: "English",
    te: "Telugu",
    hi: "Hindi",
  };
  const targetLang = languageNames[languageCode] || languageCode;

  let factsSummary = `Food: ${facts.foodName}\n`;
  if (facts.categoryName) factsSummary += `Category: ${facts.categoryName}\n`;
  if (facts.foodType) factsSummary += `Dietary Type: ${facts.foodType}\n`;
  if (facts.servingSizeG) factsSummary += `Serving Size: ${facts.servingSizeG}g\n`;
  if (facts.description) factsSummary += `Overview: ${facts.description}\n`;

  if (facts.nutrients && facts.nutrients.length > 0) {
    factsSummary += `Nutritional Values:\n` + facts.nutrients.map(n => `- ${n.name}: ${n.amount} ${n.unit}`).join("\n") + "\n";
  }

  if (facts.healthTopics && facts.healthTopics.length > 0) {
    factsSummary += `Health Topics Supported:\n` + facts.healthTopics.map(h => `- ${h.name}: ${h.relationship}${h.evidenceNote ? ` (${h.evidenceNote})` : ""}`).join("\n") + "\n";
  }

  let task = "";
  switch (contentType) {
    case "basic":
      task = `Explain the health benefits and nutrition of ${facts.foodName} in simple, easy-to-understand terms. Focus on why it is good for daily diet.`;
      break;
    case "detailed":
      task = `Provide a comprehensive breakdown of ${facts.foodName}, detailing key macronutrients, vitamins, minerals, and how they support body functions.`;
      break;
    case "vitamins":
      task = `Detail the specific vitamins and minerals found in ${facts.foodName} and explain their role in maintaining energy and overall health.`;
      break;
    case "health_support":
      task = `Explain how ${facts.foodName} supports wellness (e.g. digestion, heart health, bone health, immunity) based on its verified nutrients.`;
      break;
    case "meal_ideas":
      task = `Provide 3 healthy, simple meal or snack preparation ideas incorporating ${facts.foodName}.`;
      break;
    default:
      task = `Explain the nutritional value and health benefits of ${facts.foodName}.`;
  }

  const prompt = `Verified Nutrition Data:
${factsSummary}

Task:
${task}

IMPORTANT INSTRUCTIONS:
- Write the entire response in ${targetLang}.
- Keep numerical nutrient values consistent with the facts provided above.
- Include a short disclaimer at the bottom: "Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice."`;

  return {
    prompt,
    systemPrompt: SYSTEM_PROMPT,
  };
}

export function buildQuestionPrompt(
  question: string,
  languageCode: SupportedLanguage,
  facts?: FoodFactContext
): { prompt: string; systemPrompt: string } {
  const languageNames: Record<string, string> = {
    en: "English",
    te: "Telugu",
    hi: "Hindi",
  };
  const targetLang = languageNames[languageCode] || languageCode;

  let factsSummary = "";
  if (facts) {
    factsSummary = `Context Facts for ${facts.foodName}:\n- Category: ${facts.categoryName || "Food"}\n`;
    if (facts.nutrients && facts.nutrients.length > 0) {
      factsSummary += `Nutrients: ` + facts.nutrients.map(n => `${n.name} ${n.amount}${n.unit}`).join(", ") + "\n";
    }
  }

  const prompt = `${factsSummary}User Question: ${question}

Instructions:
- Answer the user's question clearly, concisely, and accurately in ${targetLang}.
- Do not provide medical diagnosis or treatment advice.
- Include a short health disclaimer at the end in ${targetLang}.`;

  return {
    prompt,
    systemPrompt: SYSTEM_PROMPT,
  };
}
