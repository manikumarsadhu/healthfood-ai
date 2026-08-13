-- ============================================================
-- INITIAL FOOD CATALOG
-- ============================================================

-- Fruits

INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'banana',
    'Banana',
    id,
    'vegetarian',
    'A naturally sweet fruit containing carbohydrates, fiber, potassium and vitamin B6.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'apple',
    'Apple',
    id,
    'vegetarian',
    'A fruit containing fiber, carbohydrates and several vitamins and minerals.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'orange',
    'Orange',
    id,
    'vegetarian',
    'A citrus fruit known for vitamin C and naturally occurring carbohydrates.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'mango',
    'Mango',
    id,
    'vegetarian',
    'A tropical fruit containing carbohydrates and several vitamins and minerals.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'watermelon',
    'Watermelon',
    id,
    'vegetarian',
    'A water-rich fruit containing carbohydrates and small amounts of vitamins and minerals.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'grapes',
    'Grapes',
    id,
    'vegetarian',
    'Small fruits containing carbohydrates, water and various plant compounds.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'pineapple',
    'Pineapple',
    id,
    'vegetarian',
    'A tropical fruit containing vitamin C, carbohydrates and water.',
    100
FROM categories
WHERE slug = 'fruits';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'strawberry',
    'Strawberry',
    id,
    'vegetarian',
    'A fruit containing vitamin C, fiber and naturally occurring carbohydrates.',
    100
FROM categories
WHERE slug = 'fruits';


-- Vegetables

INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'spinach',
    'Spinach',
    id,
    'vegetarian',
    'A leafy green vegetable containing folate, vitamin K, vitamin A and minerals.',
    100
FROM categories
WHERE slug = 'vegetables';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'carrot',
    'Carrot',
    id,
    'vegetarian',
    'A root vegetable rich in beta-carotene and containing fiber.',
    100
FROM categories
WHERE slug = 'vegetables';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'broccoli',
    'Broccoli',
    id,
    'vegetarian',
    'A cruciferous vegetable containing vitamin C, vitamin K and fiber.',
    100
FROM categories
WHERE slug = 'vegetables';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'tomato',
    'Tomato',
    id,
    'vegetarian',
    'A vegetable commonly used in many cuisines and containing vitamin C and other nutrients.',
    100
FROM categories
WHERE slug = 'vegetables';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'potato',
    'Potato',
    id,
    'vegetarian',
    'A starchy vegetable containing carbohydrates, potassium and vitamin C.',
    100
FROM categories
WHERE slug = 'vegetables';


-- Non-vegetarian

INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'chicken',
    'Chicken',
    id,
    'non_vegetarian',
    'A protein-rich animal food containing protein and several vitamins and minerals.',
    100
FROM categories
WHERE slug = 'meat';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'fish',
    'Fish',
    id,
    'non_vegetarian',
    'Fish can provide protein and, depending on the species, omega-3 fatty acids and other nutrients.',
    100
FROM categories
WHERE slug = 'fish-seafood';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'egg',
    'Egg',
    id,
    'non_vegetarian',
    'An animal food containing protein and several vitamins and minerals.',
    100
FROM categories
WHERE slug = 'eggs';


-- Other foods

INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'milk',
    'Milk',
    id,
    'vegetarian',
    'A dairy food containing protein, calcium and other nutrients.',
    100
FROM categories
WHERE slug = 'dairy';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'oats',
    'Oats',
    id,
    'vegetarian',
    'A grain containing carbohydrates, protein and dietary fiber.',
    100
FROM categories
WHERE slug = 'grains';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'lentils',
    'Lentils',
    id,
    'vegetarian',
    'Legumes containing protein, carbohydrates, dietary fiber, folate and minerals.',
    100
FROM categories
WHERE slug = 'legumes';


INSERT INTO foods
    (slug, name, category_id, food_type, description, serving_size_g)
SELECT
    'peanut',
    'Peanut',
    id,
    'vegetarian',
    'A legume containing protein, fat, fiber and several micronutrients.',
    100
FROM categories
WHERE slug = 'nuts-seeds';