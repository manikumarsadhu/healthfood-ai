export type SupportedLanguage = "en" | "te" | "hi" | string;

export type ContentType = "basic" | "detailed" | "vitamins" | "health_support" | "meal_ideas" | "question";

export interface FoodFactContext {
  foodName: string;
  categoryName?: string;
  foodType?: string;
  servingSizeG?: number | null;
  description?: string | null;
  nutrients?: Array<{ name: string; amount: number; unit: string }>;
  healthTopics?: Array<{ name: string; relationship: string; evidenceNote?: string }>;
}

export interface AIRequestOptions {
  foodId?: number;
  foodSlug?: string;
  prompt: string;
  systemPrompt?: string;
  languageCode: SupportedLanguage;
  contentType: ContentType;
  promptVersion?: string;
  factsContext?: FoodFactContext;
}

export interface AIResponse {
  content: string;
  modelProvider: string;
  modelName: string;
  generatedAt: string;
  attemptedProviders?: string[];
  rateLimitHits?: string[];
}

export class RateLimitException extends Error {
  provider: string;
  statusCode?: number;

  constructor(provider: string, message: string, statusCode?: number) {
    super(`[${provider}] Rate limit or quota exceeded: ${message}`);
    this.name = "RateLimitException";
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export class ProviderUnavailableException extends Error {
  provider: string;

  constructor(provider: string, message: string) {
    super(`[${provider}] Provider unavailable: ${message}`);
    this.name = "ProviderUnavailableException";
    this.provider = provider;
  }
}

export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  generateText(prompt: string, systemPrompt?: string): Promise<AIResponse>;
}
