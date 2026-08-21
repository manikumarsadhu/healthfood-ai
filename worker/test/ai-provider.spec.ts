import { describe, it, expect } from "vitest";
import { AIProviderManager } from "../src/ai/provider-manager";
import { AIProvider, AIResponse, RateLimitException } from "../src/ai/types";
import { validateAndNormalizeAIResponse } from "../src/ai/safety";

class MockAIProvider implements AIProvider {
  name: string;
  shouldFailWithLimit: boolean;
  shouldFailWithServerError: boolean;
  responseContent: string;

  constructor(
    name: string,
    shouldFailWithLimit = false,
    responseContent = "Sample response",
    shouldFailWithServerError = false
  ) {
    this.name = name;
    this.shouldFailWithLimit = shouldFailWithLimit;
    this.responseContent = responseContent;
    this.shouldFailWithServerError = shouldFailWithServerError;
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    if (this.shouldFailWithLimit) {
      throw new RateLimitException(this.name, "429 Too Many Requests", 429);
    }
    if (this.shouldFailWithServerError) {
      throw new Error(`[${this.name}] HTTP 500: Internal Server Error`);
    }
    return {
      content: this.responseContent,
      modelProvider: this.name,
      modelName: `${this.name.toLowerCase()}-mock-model`,
      generatedAt: new Date().toISOString(),
    };
  }
}

describe("AIProviderManager Fallback Loop & OmniRoute Gateway", () => {
  it("Test 1 — OmniRoute configured: OmniRoute is first provider", async () => {
    const omniroute = new MockAIProvider("OmniRoute", false, "OmniRoute response");
    const cerebras = new MockAIProvider("Cerebras", false, "Cerebras response");

    const manager = new AIProviderManager({}, [omniroute, cerebras]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("OmniRoute");
    expect(res.content).toBe("OmniRoute response");
    expect(res.attemptedProviders).toEqual(["OmniRoute"]);
  });

  it("Test 2 — OmniRoute unavailable/error: falls back to Cerebras", async () => {
    const omniroute = new MockAIProvider("OmniRoute", false, "", true); // 500 error
    const cerebras = new MockAIProvider("Cerebras", false, "Cerebras fallback response");

    const manager = new AIProviderManager({}, [omniroute, cerebras]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("Cerebras");
    expect(res.content).toBe("Cerebras fallback response");
    expect(res.attemptedProviders).toEqual(["OmniRoute", "Cerebras"]);
  });

  it("Test 3 — OmniRoute HTTP 429 rate limit: falls back to Cerebras", async () => {
    const omniroute = new MockAIProvider("OmniRoute", true); // Rate limit 429
    const cerebras = new MockAIProvider("Cerebras", false, "Cerebras fallback response");

    const manager = new AIProviderManager({}, [omniroute, cerebras]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("Cerebras");
    expect(res.content).toBe("Cerebras fallback response");
    expect(res.rateLimitHits).toEqual(["OmniRoute"]);
  });

  it("Test 4 — OmniRoute HTTP 500 server error: falls back to Cerebras", async () => {
    const omniroute = new MockAIProvider("OmniRoute", false, "", true);
    const cerebras = new MockAIProvider("Cerebras", false, "Cerebras fallback response");

    const manager = new AIProviderManager({}, [omniroute, cerebras]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("Cerebras");
    expect(res.content).toBe("Cerebras fallback response");
  });

  it("Test 5 — OmniRoute unconfigured: executes Cerebras → Gemini → Groq → OpenRouter chain", async () => {
    const cerebras = new MockAIProvider("Cerebras", true);
    const gemini = new MockAIProvider("Gemini", true);
    const groq = new MockAIProvider("Groq", false, "Groq response");
    const openrouter = new MockAIProvider("OpenRouter", false, "OpenRouter response");

    const manager = new AIProviderManager({}, [cerebras, gemini, groq, openrouter]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("Groq");
    expect(res.content).toBe("Groq response");
    expect(res.attemptedProviders).toEqual(["Cerebras", "Gemini", "Groq"]);
    expect(res.rateLimitHits).toEqual(["Cerebras", "Gemini"]);
  });

  it("Test 6 — All providers fail: throws aggregate error without leaking sensitive internals", async () => {
    const omniroute = new MockAIProvider("OmniRoute", true);
    const cerebras = new MockAIProvider("Cerebras", true);
    const gemini = new MockAIProvider("Gemini", true);

    const manager = new AIProviderManager({}, [omniroute, cerebras, gemini]);

    await expect(manager.generateText("Explain banana nutrition")).rejects.toThrow(
      "All AI providers failed or hit rate limits"
    );
  });
});

describe("AI Safety & Normalization", () => {
  it("Test 7 — Response normalization: appends medical disclaimer if missing", () => {
    const raw = "Bananas are rich in potassium and vitamin B6.";
    const normalized = validateAndNormalizeAIResponse(raw, "en");
    expect(normalized).toContain("Bananas are rich in potassium");
    expect(normalized).toContain("Disclaimer: Information is for educational purposes");
  });

  it("should retain existing disclaimers without duplication", () => {
    const raw = "Bananas are nutritious. Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice.";
    const normalized = validateAndNormalizeAIResponse(raw, "en");
    expect(normalized.match(/Disclaimer/g)?.length).toBe(1);
  });
});

