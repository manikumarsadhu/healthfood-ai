import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/index";

import m1 from "../migrations/0001_initial.sql?raw";
import m2 from "../migrations/0002_food_catalog.sql?raw";
import m3 from "../migrations/0003_nutrition_source.sql?raw";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function applySql(db: D1Database, sql: string) {
  const cleanSql = sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  const statements = cleanSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    if (stmt.toLowerCase().startsWith("pragma")) continue;
    await db.prepare(stmt).run();
  }
}

describe("HealthFood AI Worker API", () => {
  beforeAll(async () => {
    await applySql(env.healthfood_db, m1);
    await applySql(env.healthfood_db, m2);
    await applySql(env.healthfood_db, m3);
  });

  it("responds with health status at /api/health", async () => {
    const request = new IncomingRequest("http://example.com/api/health");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.service).toBe("healthfood-api");
    expect(data.database).toBe("connected");
  });

  it("returns app configuration at /api/config", async () => {
    const request = new IncomingRequest("http://example.com/api/config");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.appName).toBe("HealthFood AI");
    expect(data.version).toBe("1.0.0");
    expect(Array.isArray(data.supportedLanguages)).toBe(true);
    expect(Array.isArray(data.supportedContentTypes)).toBe(true);
  });

  it("returns a daily tip at /api/daily-tip", async () => {
    const request = new IncomingRequest("http://example.com/api/daily-tip");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.tip).toBeDefined();
    expect(data.tip.title).toBeDefined();
    expect(data.tip.food).toBeDefined();
  });

  it("returns food categories at /api/categories", async () => {
    const request = new IncomingRequest("http://example.com/api/categories");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
  });

  it("returns list of foods at /api/foods", async () => {
    const request = new IncomingRequest("http://example.com/api/foods");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.foods)).toBe(true);
    expect(data.foods.length).toBeGreaterThan(0);
  });

  it("returns details for a specific food at /api/foods/:slug", async () => {
    const request = new IncomingRequest("http://example.com/api/foods/banana");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.food).toBeDefined();
    expect(data.food.slug).toBe("banana");
    expect(Array.isArray(data.nutrition)).toBe(true);
  });

  it("returns 404 for nonexistent food slug", async () => {
    const request = new IncomingRequest("http://example.com/api/foods/nonexistent-food-123");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Food not found");
  });

  it("searches foods by query at /api/search?q=banana", async () => {
    const request = new IncomingRequest("http://example.com/api/search?q=banana");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.query).toBe("banana");
    expect(Array.isArray(data.foods)).toBe(true);
    expect(data.foods.length).toBeGreaterThan(0);
  });

  it("returns 400 when search query is too short", async () => {
    const request = new IncomingRequest("http://example.com/api/search?q=a");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("at least 2 characters");
  });

  it("validates AI question minimum length", async () => {
    const request = new IncomingRequest("http://example.com/api/ai/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "hi" }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("at least 3 characters");
  });

  it("validates AI question maximum length (500 chars limit)", async () => {
    const longQuestion = "a".repeat(501);
    const request = new IncomingRequest("http://example.com/api/ai/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: longQuestion }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("exceeds maximum limit of 500 characters");
  });

  it("returns 413 when payload exceeds 10KB content-length limit", async () => {
    const request = new IncomingRequest("http://example.com/api/ai/question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "15000",
      },
      body: JSON.stringify({ question: "What are the health benefits of eating bananas every day?" }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(413);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("exceeds maximum allowed size");
  });

  it("returns 404 for unknown endpoint", async () => {
    const response = await SELF.fetch("https://example.com/api/nonexistent");
    expect(response.status).toBe(404);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Endpoint not found");
  });
});
