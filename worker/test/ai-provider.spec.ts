import { describe, it, expect } from "vitest";
import { AIProviderManager } from "../src/ai/provider-manager";
import { AIProvider, AIResponse, RateLimitException } from "../src/ai/types";
import { validateAndNormalizeAIResponse } from "../src/ai/safety";

// Mock provider class for testing fallback loop
class MockAIProvider implements AIProvider {
  name: string;
  shouldFailWithLimit: boolean;
  responseContent: string;

  constructor(name: string, shouldFailWithLimit = false, responseContent = "Sample response") {
    this.name = name;
    this.shouldFailWithLimit = shouldFailWithLimit;
    this.responseContent = responseContent;
  }

  isConfigured(): boolean {
    return true;
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    if (this.shouldFailWithLimit) {
      throw new RateLimitException(this.name, "429 Too Many Requests", 429);
    }
    return {
      content: this.responseContent,
      modelProvider: this.name,
      modelName: `${this.name.toLowerCase()}-mock-model`,
      generatedAt: new Date().toISOString(),
    };
  }
}

describe("AIProviderManager Fallback Loop", () => {
  it("should complete with primary provider if primary provider succeeds", async () => {
    const gemini = new MockAIProvider("Gemini", false, "Gemini content");
    const groq = new MockAIProvider("Groq", false, "Groq content");
    const openrouter = new MockAIProvider("OpenRouter", false, "OpenRouter content");

    const manager = new AIProviderManager({}, [gemini, groq, openrouter]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("Gemini");
    expect(res.content).toBe("Gemini content");
    expect(res.attemptedProviders).toEqual(["Gemini"]);
    expect(res.rateLimitHits).toEqual([]);
  });

  it("should loop to secondary provider when primary provider hits rate limit (429)", async () => {
    const gemini = new MockAIProvider("Gemini", true); // Rate limit 429
    const groq = new MockAIProvider("Groq", false, "Groq content");
    const openrouter = new MockAIProvider("OpenRouter", false, "OpenRouter content");

    const manager = new AIProviderManager({}, [gemini, groq, openrouter]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("Groq");
    expect(res.content).toBe("Groq content");
    expect(res.attemptedProviders).toEqual(["Gemini", "Groq"]);
    expect(res.rateLimitHits).toEqual(["Gemini"]);
  });

  it("should loop through primary and secondary providers to tertiary provider when both hit rate limits", async () => {
    const gemini = new MockAIProvider("Gemini", true); // Rate limit 429
    const groq = new MockAIProvider("Groq", true);     // Rate limit 429
    const openrouter = new MockAIProvider("OpenRouter", false, "OpenRouter fallback content");

    const manager = new AIProviderManager({}, [gemini, groq, openrouter]);
    const res = await manager.generateText("Explain banana nutrition");

    expect(res.modelProvider).toBe("OpenRouter");
    expect(res.content).toBe("OpenRouter fallback content");
    expect(res.attemptedProviders).toEqual(["Gemini", "Groq", "OpenRouter"]);
    expect(res.rateLimitHits).toEqual(["Gemini", "Groq"]);
  });

  it("should throw an aggregate error if all providers hit rate limits", async () => {
    const gemini = new MockAIProvider("Gemini", true);
    const groq = new MockAIProvider("Groq", true);
    const openrouter = new MockAIProvider("OpenRouter", true);

    const manager = new AIProviderManager({}, [gemini, groq, openrouter]);

    await expect(manager.generateText("Explain banana nutrition")).rejects.toThrow(
      "All AI providers failed or hit rate limits"
    );
  });
});

describe("AI Safety & Normalization", () => {
  it("should append disclaimer if missing", () => {
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
