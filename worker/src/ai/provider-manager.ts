import {
  AIProvider,
  AIResponse,
  RateLimitException,
  ProviderUnavailableException,
} from "./types";

export interface ProviderEnvSecrets {
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

// Helper to check if HTTP status or response indicates rate limit / quota exhaustion
function isRateLimitOrQuotaError(status: number, bodyText: string): boolean {
  if (status === 429 || status === 403 || status === 402 || status === 503) {
    return true;
  }
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests") ||
    lower.includes("out of credits") ||
    lower.includes("overloaded")
  );
}

// 1. Google Gemini Provider
export class GeminiProvider implements AIProvider {
  name = "Gemini";
  private apiKey: string;
  private model = "gemini-1.5-flash";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new ProviderUnavailableException(this.name, "API key not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const contents = [];
    if (systemPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: `[System Instruction]\n${systemPrompt}` }],
      });
      contents.push({
        role: "model",
        parts: [{ text: "Understood. I will strictly follow these instructions." }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        },
      }),
    });

    const resText = await response.text();

    if (!response.ok || isRateLimitOrQuotaError(response.status, resText)) {
      if (isRateLimitOrQuotaError(response.status, resText)) {
        throw new RateLimitException(this.name, `HTTP ${response.status}: ${resText.slice(0, 200)}`, response.status);
      }
      throw new Error(`[Gemini] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
    }

    try {
      const data = JSON.parse(resText);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("[Gemini] Empty text in response candidate");
      }

      return {
        content: text,
        modelProvider: this.name,
        modelName: this.model,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof RateLimitException) throw err;
      throw new Error(`[Gemini] Failed to parse response: ${err.message}`);
    }
  }
}

// 2. Groq Provider
export class GroqProvider implements AIProvider {
  name = "Groq";
  private apiKey: string;
  private model = "llama-3.3-70b-versatile";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new ProviderUnavailableException(this.name, "API key not configured");
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    const resText = await response.text();

    if (!response.ok || isRateLimitOrQuotaError(response.status, resText)) {
      if (isRateLimitOrQuotaError(response.status, resText)) {
        throw new RateLimitException(this.name, `HTTP ${response.status}: ${resText.slice(0, 200)}`, response.status);
      }
      throw new Error(`[Groq] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
    }

    try {
      const data = JSON.parse(resText);
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("[Groq] Empty choices in response");
      }

      return {
        content: text,
        modelProvider: this.name,
        modelName: this.model,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof RateLimitException) throw err;
      throw new Error(`[Groq] Failed to parse response: ${err.message}`);
    }
  }
}

// 3. OpenRouter Provider
export class OpenRouterProvider implements AIProvider {
  name = "OpenRouter";
  private apiKey: string;
  private model = "google/gemini-2.5-flash:free";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new ProviderUnavailableException(this.name, "API key not configured");
    }

    const url = "https://openrouter.ai/api/v1/chat/completions";
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://healthfood.ai",
        "X-Title": "HealthFood AI",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    const resText = await response.text();

    if (!response.ok || isRateLimitOrQuotaError(response.status, resText)) {
      if (isRateLimitOrQuotaError(response.status, resText)) {
        throw new RateLimitException(this.name, `HTTP ${response.status}: ${resText.slice(0, 200)}`, response.status);
      }
      throw new Error(`[OpenRouter] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
    }

    try {
      const data = JSON.parse(resText);
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("[OpenRouter] Empty choices in response");
      }

      return {
        content: text,
        modelProvider: this.name,
        modelName: this.model,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof RateLimitException) throw err;
      throw new Error(`[OpenRouter] Failed to parse response: ${err.message}`);
    }
  }
}

// AI Provider Manager with Fallback Loop based on limits
export class AIProviderManager {
  private providers: AIProvider[];

  constructor(secrets: ProviderEnvSecrets, customProviders?: AIProvider[]) {
    if (customProviders && customProviders.length > 0) {
      this.providers = customProviders;
    } else {
      this.providers = [
        new GeminiProvider(secrets.GEMINI_API_KEY),
        new GroqProvider(secrets.GROQ_API_KEY),
        new OpenRouterProvider(secrets.OPENROUTER_API_KEY),
      ];
    }
  }

  /**
   * Executes prompt against providers in priority order.
   * If a provider hits a rate limit / quota limit or is unavailable,
   * it automatically loops to the next provider until generation completes.
   */
  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    const attemptedProviders: string[] = [];
    const rateLimitHits: string[] = [];
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      attemptedProviders.push(provider.name);

      if (!provider.isConfigured()) {
        console.warn(`[AIProviderManager] Skipping unconfigured provider: ${provider.name}`);
        errors.push({ provider: provider.name, error: "API key missing/empty" });
        continue;
      }

      try {
        console.log(`[AIProviderManager] Attempting provider: ${provider.name}`);
        const result = await provider.generateText(prompt, systemPrompt);

        return {
          ...result,
          attemptedProviders,
          rateLimitHits,
        };
      } catch (err: any) {
        if (err instanceof RateLimitException) {
          console.warn(`[AIProviderManager] Rate limit / quota hit on ${provider.name}: ${err.message}. Looping to next provider...`);
          rateLimitHits.push(provider.name);
          errors.push({ provider: provider.name, error: err.message });
        } else if (err instanceof ProviderUnavailableException) {
          console.warn(`[AIProviderManager] Provider ${provider.name} unavailable: ${err.message}. Looping to next provider...`);
          errors.push({ provider: provider.name, error: err.message });
        } else {
          console.error(`[AIProviderManager] Error from ${provider.name}: ${err.message}. Looping to next provider...`);
          errors.push({ provider: provider.name, error: err.message });
        }
      }
    }

    // All providers in the loop failed
    const errorDetails = errors.map(e => `${e.provider}: ${e.error}`).join("; ");
    throw new Error(`All AI providers failed or hit rate limits. Details: [${errorDetails}]`);
  }
}
