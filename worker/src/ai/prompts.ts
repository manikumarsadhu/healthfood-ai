import { FoodFactContext, SupportedLanguage, ContentType } from "./types";

export const FOOD_EXPLANATION_SYSTEM_PROMPT = `You are HealthFood AI, an expert, evidence-based nutrition and food-health assistant.

OUTPUT FORMAT REQUIREMENTS:
Whenever summarizing any food, fruit, vegetable, dish, or beverage, ALWAYS format your response in clear, structured Markdown matching the following reference template:

### 🍌 [Food Name] nutrition

For **1 [serving size] (~[weight] g)** (e.g. For 1 medium banana (~118 g) / Per 100 g serving):

| Nutrient | Approx. amount |
| :--- | ---: |
| Calories | [X] kcal |
| Carbohydrates | [X] g |
| Natural sugars | [X] g |
| Fiber | [X] g |
| Protein | [X] g |
| Fat | [X] g |
| Potassium | [X] mg |
| Vitamin C | [X] mg |
| Vitamin B6 | [X] mg |
| Magnesium | [X] mg |

### Key Health Benefits
- **[Benefit 1 Title]**: [Brief explanation]
- **[Benefit 2 Title]**: [Brief explanation]

*Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice.*

RULES:
1. Provide educational nutrition knowledge ONLY.
2. DO NOT make medical diagnoses, promise disease cures, or offer individual medical treatments.
3. Keep verified numerical facts (calories, grams, milligrams) strictly accurate as provided in the prompt facts context.
4. Always adopt a polite, encouraging, and clear tone suitable for general users.
5. Always use the Markdown table format above for nutrient breakdowns.`;

export const CHAT_QUESTION_SYSTEM_PROMPT = `You are HealthFood AI, a friendly, expert, evidence-based nutrition and wellness AI assistant.

GUIDELINES:
1. GREETINGS & CASUAL INTROS: If the user greets you (e.g., "hi", "hello", "hey", "hii", "good morning", "howdy"), respond warmly, introduce yourself as HealthFood AI, and ask how you can help them with their nutrition or diet goals. Do NOT output a food card or 100g nutrient table.
2. CONVERSATIONAL Q&A: Answer questions directly, naturally, and concisely in clear Markdown. Only provide a 100g nutrient table if the user explicitly requests nutrition facts or a macro breakdown of a specific food item.
3. NUTRITION FOCUS: Provide evidence-based nutrition and dietary knowledge ONLY. Do not make medical diagnoses or promise medical cures.
4. TONE: Polite, warm, encouraging, and professional.`;

export const SYSTEM_PROMPT = FOOD_EXPLANATION_SYSTEM_PROMPT;

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
    systemPrompt: FOOD_EXPLANATION_SYSTEM_PROMPT,
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

  const prompt = `${factsSummary}User Message: ${question}

Instructions:
- Write your response in ${targetLang}.
- If the user's message is a greeting (such as "hi", "hello", "hii", "hey"), respond warmly as HealthFood AI, introducing yourself and asking how you can assist with their nutrition or healthy eating goals.
- Do NOT output a food card or 100g nutrient table for greetings or simple conversational messages.
- For specific questions, provide a clear, natural, and helpful answer.
- Include a short health disclaimer at the end in ${targetLang}.`;

  return {
    prompt,
    systemPrompt: CHAT_QUESTION_SYSTEM_PROMPT,
  };
}
