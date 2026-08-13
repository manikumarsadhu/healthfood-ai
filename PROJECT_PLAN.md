# HealthFood AI — Long-Term Zero-Cost Implementation Plan (PRD)

> **Architectural Blueprint**: A multilingual nutrition and food-health education SPA/PWA built on a serverless architecture, shared AI caching, SEO, privacy-conscious design, and free-tier-first infrastructure.

---

## 1. Executive Summary & Core Philosophy

**HealthFood AI** is a fast, mobile-first web application designed to help people search foods, view reliable nutrition information, understand how foods support general health, and consult an AI assistant for additional explanations in their native language.

### Core Architectural Decisions
- **Cost Target**: **$0** for development and initial operations. Design the system so paid cloud services are introduced only if traffic eventually exceeds generous free-tier limits.
- **Fact vs. AI Separation**: Nutrition values (calories, macros, vitamins) are strictly served from a curated, verified database. AI is used **only** to explain, simplify, translate, compare, and contextualize facts. This eliminates hallucination risk and minimizes expensive LLM API usage.
- **Shared Knowledge Caching**: AI explanations generated for one user are cached in Cloudflare D1 so subsequent anonymous visitors receive instant stored responses without triggering new AI generations.
- **Privacy-Conscious / No Account Required**: The core experience requires **no login or user registration**. User preferences (language, theme, favorites) are kept client-side in `localStorage`. Server-side D1 records contain shared public knowledge only.

---

## 2. Product Goals & Safety Boundaries

### Product Goals
- Make food and nutrition information accessible to non-technical users.
- Support both **vegetarian** and **non-vegetarian** foods clearly.
- Display compact, visual food cards with macro and micro nutrient breakdowns.
- Support **multilingual education**: English first, followed by **Telugu (`te`)**, **Hindi (`hi`)**, and expanding to other regional languages.
- Provide progressive web app (**PWA**) capabilities for offline caching of app shell and static food metadata.
- Optimize SEO for long-tail search queries (e.g., "spinach vitamin k content", "banana calories").
- Monetize unobtrusively via Google AdSense and voluntary UPI QR payment/donation options.

### Safety Boundaries & Non-Goals
- 🛑 **No Medical Diagnosis or Treatment**: Explicitly disclaim medical authority. Never position as a diagnostic system or claim foods "cure" diseases.
- 🛑 **No AI Fact Invention**: Never use AI as the source of truth for numeric nutrition facts when verified data exists.
- 🛑 **No Exposed API Keys**: AI provider credentials must remain strictly inside serverless Worker environment secrets.
- 🛑 **No Account Requirement**: V1 core experience must remain fully functional without user registration or email capture.

---

## 3. Core Technology Stack

| Layer | Recommended Technology | Role | Cost Target |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | HTML5 + CSS3 + Vanilla JS | Responsive SPA interface, search, cards, chat modal | Free |
| **Hosting** | Cloudflare Pages | Static frontend asset deployment & CDN edge caching | Free tier |
| **Serverless API** | Cloudflare Workers | Secure API proxy, request routing, AI orchestration | Free tier |
| **Database** | Cloudflare D1 | Serverless SQL (foods, nutrition, shared AI cache) | Free tier |
| **Fast Cache (Optional)** | Cloudflare KV | Fast key-value caching where beneficial | Free tier |
| **Large Storage (Optional)**| Cloudflare R2 | Object storage for high-res food images | Free tier |
| **AI Provider Fallback**| Gemini $\rightarrow$ Groq $\rightarrow$ OpenRouter | Multi-LLM provider fallback adapter | Free tiers |
| **PWA** | Web Manifest + Service Worker | Offline application shell caching & installation | Free |
| **SEO & Monetization** | sitemap.xml, Schema.org, AdSense, UPI | Discovery, structured data, and non-disruptive monetization | Free / Revenue |

---

## 4. High-Level System Architecture & Flow

```
User (Browser / PWA)
       │
       ▼
Cloudflare Pages (Static HTML/CSS/JS Shell)
       │
       ▼ (Dynamic API Calls)
Cloudflare Workers (API Orchestrator)
       │
       ├───► 1. Lookup verified nutrition from Cloudflare D1
       │
       ├───► 2. Check D1 Cache (`ai_content` table)
       │        ├─── Hit  ──► Return cached AI response immediately
       │        └─── Miss ──► 3. Acquire Short-Lived Generation Lock
       │                           │
       │                           ▼
       │                      4. Invoke AI Provider Manager (Gemini ➔ Groq ➔ OpenRouter)
       │                           │
       │                           ▼
       │                      5. Validate & Normalize Output
       │                           │
       │                           ▼
       │                      6. Save to D1 `ai_content` table
       │                           │
       └───────────────────────────┴──► Return Normalized Output to User
```

---

## 5. Detailed Database Architecture (Cloudflare D1)

### Tables Schema Overview

1. **`foods`**: `id`, `slug` (e.g. `banana`, `spinach`), `canonical_name`, `category_id`, `vegetarian` (boolean), `description`, `image_url`, `status`, `created_at`, `updated_at`.
2. **`nutrition`**: `id`, `food_id`, `serving_size`, `calories`, `protein_g`, `carbohydrates_g`, `fat_g`, `fiber_g`, `vitamin_a`, `vitamin_b1`, `vitamin_b2`, `vitamin_b3`, `vitamin_b6`, `vitamin_b12`, `vitamin_c`, `vitamin_d`, `vitamin_e`, `vitamin_k`, `calcium`, `iron`, `magnesium`, `potassium`, `zinc`, `source`, `source_version`.
3. **`food_aliases`**: `id`, `food_id`, `alias_name`, `language` (handles alternate spellings, regional names like *Aratikaya* for plantain).
4. **`categories`**: `id`, `slug`, `name`, `description`, `icon`, `display_order` (Fruits, Vegetables, Grains, Legumes, Dairy, Fish, Eggs, Nuts/Seeds).
5. **`ai_content`**: `id`, `food_id`, `language`, `content_type` (`basic`, `detailed`, `vitamins`, `minerals`, `health_support`, `meal_ideas`, `comparison`, `faq`), `content`, `model`, `prompt_version`, `content_version`, `status`, `created_at`, `updated_at`.
6. **`ai_questions`**: `id`, `normalized_prompt_hash`, `language`, `question`, `answer`, `status`, `created_at`.
7. **`generation_locks`**: `lock_key`, `acquired_at`, `expires_at` (prevents thundering herd duplicate generations).
8. **`daily_items`**: `id`, `food_id`, `date`, `tip_text_en`, `tip_text_te`, `tip_text_hi`.
9. **`app_config`**: `key`, `value` (feature flags, system messages, supported languages).

---

## 6. AI Caching Strategy & Cache Keys

### Logical Cache Key Format
```text
food:{foodId}:lang:{language}:type:{contentType}:version:{contentVersion}
```

### Supported Content Types
- `basic`: Simple overview of food benefits.
- `detailed`: In-depth breakdown for health enthusiasts.
- `vitamins`: Detailed explanation of vitamin content and metabolic roles.
- `minerals`: Overview of mineral benefits (iron, calcium, etc.).
- `health_support`: How the food supports digestion, heart health, immunity, etc.
- `meal_ideas`: Healthy preparation and pairing suggestions.
- `comparison`: Comparative analysis between two foods.

---

## 7. Recommended Project File Structure

```text
healthfood-ai/
├── index.html
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── icons/
│   └── images/
├── css/
│   ├── main.css
│   ├── responsive.css
│   └── themes.css
├── js/
│   ├── app.js
│   ├── router.js
│   ├── search.js
│   ├── food.js
│   ├── chatbot.js
│   ├── api-client.js
│   ├── ai-ui.js
│   ├── language-manager.js
│   ├── theme-manager.js
│   ├── notification-manager.js
│   ├── storage.js
│   └── analytics.js
├── i18n/
│   ├── en.json
│   ├── te.json
│   └── hi.json
├── data/
│   └── seed/
└── worker/
    ├── package.json
    ├── wrangler.jsonc
    ├── tsconfig.json
    ├── migrations/
    │   ├── 0001_initial.sql
    │   ├── 0002_food_catalog.sql
    │   └── 0003_nutrition_source.sql
    ├── test/
    │   ├── env.d.ts
    │   └── index.spec.ts
    └── src/
        ├── index.ts
        ├── ai/
        │   ├── provider-manager.ts
        │   ├── prompts.ts
        │   ├── safety.ts
        │   └── types.ts
        └── db/
            ├── cache.ts
            └── locks.ts
```

---

## 8. Development Roadmap (10-Phase Plan)

| Phase | Focus Area | Detailed Outcome |
| :--- | :--- | :--- |
| **Phase 0** | Repository & Architecture | Clean repository setup, Wrangler config, TypeScript standards |
| **Phase 1** | Responsive UI Shell | Mobile-first frontend layout, category chips, food card grid, search bar |
| **Phase 2** | D1 Schema & Worker API | Serverless endpoints `/api/foods`, `/api/categories`, `/api/health` |
| **Phase 3** | Verified Nutrition Data | Seed initial 100–300 foods dataset into D1 with source attribution |
| **Phase 4** | AI Manager & Caching | Implement Gemini/Groq/OpenRouter fallback, SHA-256 caching & generation locks |
| **Phase 5** | Multilingual & Themes | i18n support (English, Telugu, Hindi) and dark/light theme persistence in `localStorage` |
| **Phase 6** | PWA & Offline Cache | Web manifest, Service Worker shell caching, graceful offline fallback messages |
| **Phase 7** | SEO Routes & Schemas | Static route URLs (`/foods/:slug`), sitemap.xml, Schema.org nutrition structured data |
| **Phase 8** | Daily Tips & Notifications | In-app daily food highlight & local client-side notification preferences |
| **Phase 9** | Monetization & Legal | Non-disruptive AdSense slots, voluntary UPI donation section, privacy & health disclaimers |
| **Phase 10**| Hardening & Production | Rate limiting, input sanitization, security headers, production D1 deployment |

---

## 9. SEO & Routing Strategy

- **URL Patterns**:
  - Home: `/`
  - Food Detail: `/foods/banana`, `/foods/spinach`
  - Categories: `/categories/fruits`, `/categories/vegetables`
  - Nutrients: `/nutrients/vitamin-c`, `/nutrients/iron`
- **Structured Data**: Include Schema.org `WebSite`, `WebApplication`, `BreadcrumbList`, and `NutritionInformation`.
- **Fast Core Web Vitals**: Zero heavy JS frameworks, optimized WebP images, lazy loading below-the-fold content.

---

## 10. Abuse & Cost Protection Strategies

- **Cache-First Always**: Never invoke AI if content exists in D1 `ai_content`.
- **Pre-Seeded Popular Content**: Pre-generate basic & detailed AI explanations for top 50 searched foods before launch.
- **Request Sanitization**: Validate prompt length and enforce strict JSON response schemas.
- **IP Cooldown & Daily Quotas**: Implement per-IP request limits on AI endpoint to prevent abuse without locking out genuine users.

---

## 11. Launch Checklist & Verification

- [x] Cloudflare Worker core engine & routing (`worker/src/index.ts`).
- [x] Vitest suite passing 19/19 test cases (`npx vitest run`).
- [x] TypeScript `*.sql?raw` module declarations fixed (`test/env.d.ts`).
- [ ] Deploy D1 migrations to production (`npx wrangler d1 migrations apply healthfood_db --remote`).
- [ ] Configure Worker secrets (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`).
- [ ] Deploy Cloudflare Worker (`npx wrangler deploy`).
- [ ] Build Frontend SPA/PWA in repository root and deploy to Cloudflare Pages.
- [ ] Verify multi-language support (English, Telugu, Hindi).
- [ ] Submit sitemap to Google Search Console and apply for Google AdSense.

---

*Updated based on HealthFood AI Long-Term Implementation Blueprint.*
