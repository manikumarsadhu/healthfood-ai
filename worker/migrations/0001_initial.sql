PRAGMA foreign_keys = ON;

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_active
ON categories(is_active, sort_order);


-- ============================================================
-- FOODS
-- ============================================================

CREATE TABLE foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    scientific_name TEXT,
    category_id INTEGER NOT NULL,
    food_type TEXT NOT NULL DEFAULT 'vegetarian',
    description TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    serving_size_g REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_foods_category
ON foods(category_id);

CREATE INDEX idx_foods_name
ON foods(name);

CREATE INDEX idx_foods_active
ON foods(is_active);


-- ============================================================
-- FOOD ALIASES
-- Helps search:
-- banana / bananas / kela / arati pandu etc.
-- ============================================================

CREATE TABLE food_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    language_code TEXT NOT NULL DEFAULT 'en',

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    UNIQUE(food_id, alias, language_code)
);

CREATE INDEX idx_food_aliases_alias
ON food_aliases(alias);

CREATE INDEX idx_food_aliases_food
ON food_aliases(food_id);


-- ============================================================
-- NUTRIENTS
-- One table supports calories, protein, vitamins, minerals etc.
-- ============================================================

CREATE TABLE nutrients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    nutrient_group TEXT NOT NULL,
    default_unit TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_nutrients_group
ON nutrients(nutrient_group);


-- ============================================================
-- FOOD NUTRITION
-- Nutrition values are stored independently from AI.
-- Default basis is per 100g.
-- ============================================================

CREATE TABLE food_nutrients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    nutrient_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    unit TEXT NOT NULL,
    basis_g REAL NOT NULL DEFAULT 100,
    source_name TEXT,
    source_url TEXT,
    source_version TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (nutrient_id)
        REFERENCES nutrients(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    UNIQUE(food_id, nutrient_id, basis_g)
);

CREATE INDEX idx_food_nutrients_food
ON food_nutrients(food_id);

CREATE INDEX idx_food_nutrients_nutrient
ON food_nutrients(nutrient_id);


-- ============================================================
-- HEALTH TOPICS
-- Use "supports" rather than claiming food "cures" an issue.
-- ============================================================

CREATE TABLE health_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- FOOD ↔ HEALTH TOPICS
-- ============================================================

CREATE TABLE food_health_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    health_topic_id INTEGER NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'supports',
    evidence_note TEXT,
    source_name TEXT,
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (health_topic_id)
        REFERENCES health_topics(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    UNIQUE(food_id, health_topic_id)
);

CREATE INDEX idx_food_health_food
ON food_health_topics(food_id);

CREATE INDEX idx_food_health_topic
ON food_health_topics(health_topic_id);


-- ============================================================
-- AI GENERATED CONTENT
--
-- This is the most important table for shared AI caching.
--
-- Example:
-- banana + en + basic
-- banana + te + basic
-- banana + en + detailed
-- ============================================================

CREATE TABLE ai_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    food_id INTEGER NOT NULL,

    language_code TEXT NOT NULL DEFAULT 'en',

    content_type TEXT NOT NULL DEFAULT 'basic',

    prompt_version TEXT NOT NULL DEFAULT 'v1',

    model_provider TEXT,
    model_name TEXT,

    content TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'published',

    source_summary TEXT,

    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    UNIQUE(
        food_id,
        language_code,
        content_type,
        prompt_version
    )
);

CREATE INDEX idx_ai_content_lookup
ON ai_content(
    food_id,
    language_code,
    content_type,
    prompt_version
);

CREATE INDEX idx_ai_content_status
ON ai_content(status);


-- ============================================================
-- USER QUESTIONS / POPULAR REQUESTS
--
-- No user account required.
-- We store anonymized/common questions for improving the system.
-- ============================================================

CREATE TABLE ai_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    food_id INTEGER,

    language_code TEXT NOT NULL DEFAULT 'en',

    question TEXT NOT NULL,

    question_hash TEXT,

    answer_content_id INTEGER,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON DELETE SET NULL,

    FOREIGN KEY (answer_content_id)
        REFERENCES ai_content(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_ai_questions_food
ON ai_questions(food_id);

CREATE INDEX idx_ai_questions_hash
ON ai_questions(question_hash);


-- ============================================================
-- AI GENERATION LOCK
--
-- Prevents 20 users from generating the same food response
-- simultaneously when cache is empty.
-- ============================================================

CREATE TABLE generation_locks (
    cache_key TEXT PRIMARY KEY,

    food_id INTEGER,

    language_code TEXT NOT NULL,

    content_type TEXT NOT NULL,

    prompt_version TEXT NOT NULL,

    locked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    expires_at TEXT NOT NULL,

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON DELETE CASCADE
);


-- ============================================================
-- DAILY HEALTH TIPS
-- ============================================================

CREATE TABLE daily_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    food_id INTEGER NOT NULL,

    language_code TEXT NOT NULL DEFAULT 'en',

    title TEXT NOT NULL,

    message TEXT NOT NULL,

    scheduled_date TEXT NOT NULL,

    is_published INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON DELETE CASCADE,

    UNIQUE(
        food_id,
        language_code,
        scheduled_date
    )
);

CREATE INDEX idx_daily_items_date
ON daily_items(scheduled_date, language_code, is_published);


-- ============================================================
-- APPLICATION CONFIGURATION
-- ============================================================

CREATE TABLE app_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- SEED CATEGORIES
-- ============================================================

INSERT INTO categories
    (slug, name, description, sort_order)
VALUES
    ('fruits', 'Fruits', 'Fresh fruits and commonly eaten fruit foods', 1),
    ('vegetables', 'Vegetables', 'Vegetables and leafy greens', 2),
    ('meat', 'Meat', 'Common meat foods', 3),
    ('fish-seafood', 'Fish & Seafood', 'Fish and seafood foods', 4),
    ('eggs', 'Eggs', 'Eggs and egg-based foods', 5),
    ('grains', 'Grains', 'Rice, oats, wheat and other grains', 6),
    ('legumes', 'Legumes', 'Beans, lentils and pulses', 7),
    ('nuts-seeds', 'Nuts & Seeds', 'Nuts and seeds', 8),
    ('dairy', 'Dairy', 'Milk, curd, yogurt and other dairy foods', 9);


-- ============================================================
-- SEED NUTRIENTS
-- ============================================================

INSERT INTO nutrients
    (slug, name, nutrient_group, default_unit, sort_order)
VALUES
    ('energy', 'Calories', 'energy', 'kcal', 1),
    ('protein', 'Protein', 'macronutrient', 'g', 2),
    ('carbohydrates', 'Carbohydrates', 'macronutrient', 'g', 3),
    ('fat', 'Total Fat', 'macronutrient', 'g', 4),
    ('fiber', 'Dietary Fiber', 'macronutrient', 'g', 5),
    ('sugars', 'Sugars', 'carbohydrate', 'g', 6),

    ('vitamin-a', 'Vitamin A', 'vitamin', 'µg', 10),
    ('vitamin-b1', 'Vitamin B1 (Thiamine)', 'vitamin', 'mg', 11),
    ('vitamin-b2', 'Vitamin B2 (Riboflavin)', 'vitamin', 'mg', 12),
    ('vitamin-b3', 'Vitamin B3 (Niacin)', 'vitamin', 'mg', 13),
    ('vitamin-b5', 'Vitamin B5', 'vitamin', 'mg', 14),
    ('vitamin-b6', 'Vitamin B6', 'vitamin', 'mg', 15),
    ('vitamin-b9', 'Folate', 'vitamin', 'µg', 16),
    ('vitamin-b12', 'Vitamin B12', 'vitamin', 'µg', 17),
    ('vitamin-c', 'Vitamin C', 'vitamin', 'mg', 18),
    ('vitamin-d', 'Vitamin D', 'vitamin', 'µg', 19),
    ('vitamin-e', 'Vitamin E', 'vitamin', 'mg', 20),
    ('vitamin-k', 'Vitamin K', 'vitamin', 'µg', 21),

    ('calcium', 'Calcium', 'mineral', 'mg', 30),
    ('iron', 'Iron', 'mineral', 'mg', 31),
    ('magnesium', 'Magnesium', 'mineral', 'mg', 32),
    ('phosphorus', 'Phosphorus', 'mineral', 'mg', 33),
    ('potassium', 'Potassium', 'mineral', 'mg', 34),
    ('sodium', 'Sodium', 'mineral', 'mg', 35),
    ('zinc', 'Zinc', 'mineral', 'mg', 36);


-- ============================================================
-- SEED HEALTH TOPICS
-- ============================================================

INSERT INTO health_topics
    (slug, name, description)
VALUES
    ('heart-health', 'Heart Health', 'Foods and nutrients associated with supporting cardiovascular health'),
    ('digestive-health', 'Digestive Health', 'Foods and nutrients associated with digestive health'),
    ('bone-health', 'Bone Health', 'Foods and nutrients that support normal bone health'),
    ('immune-support', 'Immune Support', 'Foods and nutrients that support normal immune function'),
    ('energy', 'Energy', 'Foods and nutrients that contribute to normal energy metabolism'),
    ('muscle-health', 'Muscle Health', 'Foods and nutrients that support normal muscle function'),
    ('eye-health', 'Eye Health', 'Foods and nutrients associated with normal eye health'),
    ('skin-health', 'Skin Health', 'Foods and nutrients associated with normal skin health');