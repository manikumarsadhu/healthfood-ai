import {
  AIProvider,
  AIResponse,
  RateLimitException,
  ProviderUnavailableException,
} from "./types";

export interface ProviderEnvSecrets {
  CEREBRAS_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OMNIROUTE_API_KEY?: string;
  OMNIROUTE_URL?: string;
  OMNIROUTE_MODEL?: string;
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

// 0. OmniRoute Gateway Provider (Primary OpenAI-compatible AI Gateway)
export class OmniRouteProvider implements AIProvider {
  name = "OmniRoute";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey?: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey || "";
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, "") : "http://localhost:20128/v1";
    this.model = model || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new ProviderUnavailableException(this.name, "API key not configured");
    }

    const url = `${this.baseUrl}/chat/completions`;
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    // Automatic candidate model priority: configured model -> auto/best-free -> Mistral -> Groq -> OpenRouter Free models -> Gemini
    const candidateModels = Array.from(new Set([
      ...(this.model ? [this.model] : []),
      "auto/best-free",
      "mistral/mistral-small-latest",
      "mistral/mistral-large-latest",
      "mistral/mistral-medium-3-5",
      "mistral/codestral-latest",
      "mistral/devstral-latest",
      "groq/openai/gpt-oss-120b",
      "groq/openai/gpt-oss-20b",
      "groq/qwen/qwen3.6-27b",
      "groq/openai/gpt-oss-safeguard-20b",
      "openrouter/dots-studio/dots-3-note-preview:free",
      "openrouter/liquid/lfm-2.5-2.6b:free",
      "openrouter/nvidia/nemotron-3.5-lightning:free",
      "openrouter/poolside/laguna-s-2.1:free",
      "openrouter/poolside/laguna-xs-2.1:free",
      "openrouter/cohere/north-mini-code:free",
      "openrouter/z-ai/glm-5.2:free",
      "openrouter/nvidia/nemotron-3.5-content-safety:free",
      "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
      "openrouter/google/gemma-4-31b-it:free",
      "openrouter/openai/gpt-oss-20b:free",
      "openrouter/nvidia/nemotron-nano-9b-v2:free",
      "openrouter/nvidia/nemotron-nano-12b-v2-vl:free",
      "openrouter/nvidia/nemotron-3-nano-30b-a3b:free",
      "openrouter/nvidia/nemotron-3-super-120b-a12b:free",
      "gemini/gemini-3.5-flash-lite",
      "auto",
      "openrouter/free"
    ]));

    let lastError: Error | null = null;

    for (const targetModel of candidateModels) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        const resText = await response.text();

        if (!response.ok || isRateLimitOrQuotaError(response.status, resText)) {
          if (isRateLimitOrQuotaError(response.status, resText)) {
            lastError = new RateLimitException(this.name, `[OmniRoute] HTTP ${response.status} (${targetModel}): ${resText.slice(0, 150)}`, response.status);
          } else {
            lastError = new Error(`[OmniRoute] HTTP ${response.status} (${targetModel}): ${resText.slice(0, 150)}`);
          }
          continue; // Try next candidate model in OmniRoute
        }

        let extractedText = "";
        let returnedModel = targetModel;

        if (resText.trim().startsWith("data:")) {
          const lines = resText.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:") && !trimmed.includes("[DONE]")) {
              try {
                const chunkJson = JSON.parse(trimmed.slice(5).trim());
                if (chunkJson.model) returnedModel = chunkJson.model;
                const contentChunk = chunkJson.choices?.[0]?.delta?.content || chunkJson.choices?.[0]?.message?.content || "";
                extractedText += contentChunk;
              } catch (_) {}
            }
          }
        } else {
          try {
            const data = JSON.parse(resText);
            returnedModel = data?.model || targetModel;
            extractedText = data?.choices?.[0]?.message?.content || "";
          } catch (e) {
            lastError = new Error(`[OmniRoute] Invalid JSON response (${targetModel}): ${resText.slice(0, 150)}`);
            continue;
          }
        }

        if (!extractedText || extractedText.trim().length === 0) {
          lastError = new Error(`[OmniRoute] Empty choices (${targetModel})`);
          continue;
        }

        return {
          content: extractedText,
          modelProvider: this.name,
          modelName: returnedModel,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err instanceof RateLimitException) lastError = err;
        else lastError = err;
      }
    }

    throw lastError || new Error("[OmniRoute] All candidate models failed");
  }
}

// 1. Google Gemini Provider
export class GeminiProvider implements AIProvider {
  name = "Gemini";
  private apiKey: string;
  private candidateModels = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];

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

    let lastError: Error | null = null;
    for (const model of this.candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

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
          if (response.status === 404 || resText.includes("not found")) {
            lastError = new Error(`[Gemini] Model ${model} returned 404: ${resText.slice(0, 150)}`);
            continue;
          }
          throw new Error(`[Gemini] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
        }

        const data = JSON.parse(resText);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("[Gemini] Empty text in response candidate");
        }

        return {
          content: text,
          modelProvider: this.name,
          modelName: model,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err instanceof RateLimitException) throw err;
        lastError = err;
      }
    }

    throw lastError || new Error("[Gemini] All candidate models failed");
  }
}

// 2. Groq Provider
export class GroqProvider implements AIProvider {
  name = "Groq";
  private apiKey: string;
  private candidateModels = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "groq/compound",
    "groq/compound-mini",
    "llama-3.1-8b-instant"
  ];

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

    let lastError: Error | null = null;
    for (const model of this.candidateModels) {
      try {
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
            model,
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
          if (response.status === 404 || resText.includes("model_not_found")) {
            lastError = new Error(`[Groq] Model ${model} returned 404: ${resText.slice(0, 150)}`);
            continue;
          }
          throw new Error(`[Groq] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
        }

        const data = JSON.parse(resText);
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error("[Groq] Empty choices in response");
        }

        return {
          content: text,
          modelProvider: this.name,
          modelName: model,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err instanceof RateLimitException) throw err;
        lastError = err;
      }
    }

    throw lastError || new Error("[Groq] All candidate models failed");
  }
}

// 3. OpenRouter Provider
export class OpenRouterProvider implements AIProvider {
  name = "OpenRouter";
  private apiKey: string;
  private candidateModels = [
    "openrouter/free",
    "dots-studio/dots-3-note-preview:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "poolside/laguna-s-2.1:free",
    "poolside/laguna-xs-2.1:free",
    "cohere/north-mini-code:free",
    "z-ai/glm-5.2:free",
    "nvidia/nemotron-3.5-content-safety:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "google/gemma-4-31b-it:free",
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free"
  ];

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

    let lastError: Error | null = null;
    for (const model of this.candidateModels) {
      try {
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
            model,
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
          if (response.status === 404 || resText.includes("404")) {
            lastError = new Error(`[OpenRouter] Model ${model} returned 404: ${resText.slice(0, 150)}`);
            continue;
          }
          throw new Error(`[OpenRouter] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
        }

        const data = JSON.parse(resText);
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error("[OpenRouter] Empty choices in response");
        }

        return {
          content: text,
          modelProvider: this.name,
          modelName: model,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err instanceof RateLimitException) throw err;
        lastError = err;
      }
    }

    throw lastError || new Error("[OpenRouter] All candidate models failed");
  }
}

// 4. Cerebras Provider (Ultra-fast Llama inference free tier)
export class CerebrasProvider implements AIProvider {
  name = "Cerebras";
  private apiKey: string;
  private candidateModels = ["gpt-oss-120b", "gemma-4-31b", "llama-3.3-70b", "llama3.1-8b"];

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

    let lastError: Error | null = null;
    for (const model of this.candidateModels) {
      try {
        const url = "https://api.cerebras.ai/v1/chat/completions";
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
            model,
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
          if (response.status === 404 || resText.includes("model_not_found")) {
            lastError = new Error(`[Cerebras] Model ${model} returned 404: ${resText.slice(0, 150)}`);
            continue;
          }
          throw new Error(`[Cerebras] Request failed with HTTP ${response.status}: ${resText.slice(0, 200)}`);
        }

        const data = JSON.parse(resText);
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error("[Cerebras] Empty choices in response");
        }

        return {
          content: text,
          modelProvider: this.name,
          modelName: model,
          generatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err instanceof RateLimitException) throw err;
        lastError = err;
      }
    }

    throw lastError || new Error("[Cerebras] All candidate models failed");
  }
}

// AI Provider Manager with Fallback Loop based on limits
export class AIProviderManager {
  private providers: AIProvider[];

  constructor(secrets: ProviderEnvSecrets, customProviders?: AIProvider[]) {
    if (customProviders && customProviders.length > 0) {
      this.providers = customProviders;
    } else {
      this.providers = [];
      const omniroute = new OmniRouteProvider(secrets.OMNIROUTE_API_KEY, secrets.OMNIROUTE_URL, secrets.OMNIROUTE_MODEL);
      if (omniroute.isConfigured()) {
        this.providers.push(omniroute);
      }
      this.providers.push(
        new CerebrasProvider(secrets.CEREBRAS_API_KEY),
        new GeminiProvider(secrets.GEMINI_API_KEY),
        new GroqProvider(secrets.GROQ_API_KEY),
        new OpenRouterProvider(secrets.OPENROUTER_API_KEY)
      );
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

        console.log(`\n============================================================`);
        console.log(`✅ [AI SUCCESS] Responded using provider: ${result.modelProvider} (Model: ${result.modelName})`);
        console.log(`============================================================\n`);

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
