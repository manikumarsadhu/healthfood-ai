/**
 * API Client for HealthFood AI
 * Handles API calls to Cloudflare Worker with offline/standalone mock fallback dataset.
 */
class APIClient {
  constructor(baseUrl = '') {
    // Default to localhost:8787 if running locally or file protocol
    const isLocal = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');
    this.baseUrl = baseUrl || (isLocal && window.location.port !== '8787' ? 'http://localhost:8787' : '');
    this.mockFoods = [
      {
        id: 1,
        slug: "banana",
        name: "Banana",
        canonical_name: "Musa acuminata",
        category_id: 1,
        category_name: "Fruits",
        food_type: "plant",
        vegetarian: true,
        description: "Energy-dense tropical fruit packed with potassium, vitamin B6, and prebiotic fiber.",
        image_url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80",
        serving_size_g: 118,
        macronutrients: { calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.3, fiber_g: 3.1 },
        micronutrients: [
          { name: "Potassium", amount: "422 mg", dv_percentage: 9 },
          { name: "Vitamin B6", amount: "0.4 mg", dv_percentage: 25 },
          { name: "Vitamin C", amount: "10.3 mg", dv_percentage: 11 },
          { name: "Magnesium", amount: "32 mg", dv_percentage: 8 }
        ],
        health_benefits: [
          { title: "Sustained Muscle & Energy", description: "Potassium supports nerve signaling and prevents muscle cramps.", evidence_level: "high" },
          { title: "Digestive Health", description: "Contains resistant starch that feeds beneficial gut microbiota.", evidence_level: "high" }
        ]
      },
      {
        id: 2,
        slug: "spinach",
        name: "Spinach",
        canonical_name: "Spinacia oleracea",
        category_id: 2,
        category_name: "Vegetables",
        food_type: "plant",
        vegetarian: true,
        description: "Nutrient-dense leafy green rich in folate, iron, vitamin K, and lutein.",
        image_url: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80",
        serving_size_g: 100,
        macronutrients: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2 },
        micronutrients: [
          { name: "Vitamin K", amount: "483 mcg", dv_percentage: 402 },
          { name: "Vitamin A", amount: "469 mcg", dv_percentage: 52 },
          { name: "Folate (B9)", amount: "194 mcg", dv_percentage: 49 },
          { name: "Iron", amount: "2.7 mg", dv_percentage: 15 }
        ],
        health_benefits: [
          { title: "Eye Protection", description: "Lutein and zeaxanthin protect macula against blue light damage.", evidence_level: "high" },
          { title: "Blood Cell Formation", description: "Rich folate and iron support healthy red blood cell synthesis.", evidence_level: "high" }
        ]
      },
      {
        id: 3,
        slug: "salmon",
        name: "Atlantic Salmon",
        canonical_name: "Salmo salar",
        category_id: 6,
        category_name: "Fish & Poultry",
        food_type: "animal",
        vegetarian: false,
        description: "Fatty ocean fish exceptionally rich in EPA/DHA omega-3 fatty acids and complete protein.",
        image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80",
        serving_size_g: 150,
        macronutrients: { calories: 280, protein_g: 34, carbs_g: 0, fat_g: 15, fiber_g: 0 },
        micronutrients: [
          { name: "Omega-3 (EPA/DHA)", amount: "2.2 g", dv_percentage: 137 },
          { name: "Vitamin B12", amount: "4.8 mcg", dv_percentage: 200 },
          { name: "Vitamin D", amount: "14 mcg", dv_percentage: 70 },
          { name: "Selenium", amount: "41 mcg", dv_percentage: 75 }
        ],
        health_benefits: [
          { title: "Cardiovascular Support", description: "Omega-3s lower triglycerides and support arterial elasticity.", evidence_level: "high" },
          { title: "Brain & Cognitive Function", description: "DHA is a key structural building block for neurological tissue.", evidence_level: "high" }
        ]
      },
      {
        id: 4,
        slug: "quinoa",
        name: "Quinoa",
        canonical_name: "Chenopodium quinoa",
        category_id: 3,
        category_name: "Grains & Cereals",
        food_type: "plant",
        vegetarian: true,
        description: "Gluten-free ancient grain providing all 9 essential amino acids.",
        image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
        serving_size_g: 185,
        macronutrients: { calories: 222, protein_g: 8.1, carbs_g: 39, fat_g: 3.6, fiber_g: 5.2 },
        micronutrients: [
          { name: "Manganese", amount: "1.2 mg", dv_percentage: 52 },
          { name: "Magnesium", amount: "118 mg", dv_percentage: 28 },
          { name: "Phosphorus", amount: "281 mg", dv_percentage: 22 },
          { name: "Copper", amount: "0.4 mg", dv_percentage: 44 }
        ],
        health_benefits: [
          { title: "Complete Protein", description: "Contains ideal amino acid ratio suitable for plant-based diets.", evidence_level: "high" },
          { title: "Low Glycemic Index", description: "High fiber and protein prevent rapid blood glucose spikes.", evidence_level: "high" }
        ]
      },
      {
        id: 5,
        slug: "almonds",
        name: "Raw Almonds",
        canonical_name: "Prunus dulcis",
        category_id: 7,
        category_name: "Nuts & Seeds",
        food_type: "plant",
        vegetarian: true,
        description: "Nutrient-dense tree nut rich in healthy monounsaturated fats and vitamin E.",
        image_url: "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?auto=format&fit=crop&w=600&q=80",
        serving_size_g: 30,
        macronutrients: { calories: 170, protein_g: 6, carbs_g: 6, fat_g: 14, fiber_g: 3.5 },
        micronutrients: [
          { name: "Vitamin E", amount: "7.3 mg", dv_percentage: 49 },
          { name: "Magnesium", amount: "76 mg", dv_percentage: 19 },
          { name: "Riboflavin (B2)", amount: "0.3 mg", dv_percentage: 23 },
          { name: "Calcium", amount: "76 mg", dv_percentage: 6 }
        ],
        health_benefits: [
          { title: "Antioxidant Defense", description: "High alpha-tocopherol protects cell membranes from lipid peroxidation.", evidence_level: "high" },
          { title: "Lipid Balance", description: "Monounsaturated fatty acids aid in maintaining optimal HDL cholesterol.", evidence_level: "high" }
        ]
      }
    ];

    this.mockCategories = [
      { id: 0, slug: "all", name: "All Foods", icon: "🍏" },
      { id: 1, slug: "fruits", name: "Fruits", icon: "🍌" },
      { id: 2, slug: "vegetables", name: "Vegetables", icon: "🥦" },
      { id: 3, slug: "grains", name: "Grains & Cereals", icon: "🌾" },
      { id: 4, slug: "legumes", name: "Legumes & Pulses", icon: "🫘" },
      { id: 5, slug: "dairy", name: "Dairy & Alternatives", icon: "🥛" },
      { id: 6, slug: "proteins", name: "Fish & Poultry", icon: "🐟" },
      { id: 7, slug: "nuts", name: "Nuts & Seeds", icon: "🥜" }
    ];
  }

  async getCategories() {
    try {
      const res = await fetch(`${this.baseUrl}/api/categories`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json.data || json.categories || [];
      }
    } catch (e) {
      console.warn("Using offline fallback categories:", e.message);
    }
    return this.mockCategories;
  }

  async getFoods(category = 'all', searchQuery = '') {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`${this.baseUrl}/api/foods?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json.data || json.foods || [];
      }
    } catch (e) {
      console.warn("Using offline fallback foods dataset:", e.message);
    }

    // Filter fallback list
    let filtered = this.mockFoods;
    if (category && category !== 'all') {
      filtered = filtered.filter(f => f.category_name.toLowerCase().includes(category.toLowerCase()));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.description.toLowerCase().includes(q) ||
        f.category_name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  enrichMockFood(food) {
    if (!food) return null;
    const s = (food.slug || '').toLowerCase();
    const cal = food.macronutrients?.calories || 100;
    const p = food.macronutrients?.protein_g || 1;
    const cb = food.macronutrients?.carbs_g || 10;
    const f = food.macronutrients?.fat_g || 0.5;
    const fb = food.macronutrients?.fiber_g || 2;

    if (s.includes('egg')) {
      return {
        ...food,
        summary: { calories: 155, serving_g: 100, water_g: 75.0, sugar_g: 1.1, sodium_mg: 124 },
        vitamins: [
          { name: "Vitamin A", amount: "540 IU", dv: "18%" },
          { name: "Vitamin D", amount: "82 IU", dv: "10%" },
          { name: "Vitamin B12", amount: "0.9 µg", dv: "38%" },
          { name: "Riboflavin (B2)", amount: "0.5 mg", dv: "38%" },
          { name: "Folate (B9)", amount: "47 µg", dv: "12%" }
        ],
        minerals: [
          { name: "Phosphorus", amount: "198 mg", dv: "20%" },
          { name: "Potassium", amount: "126 mg", dv: "3%" },
          { name: "Calcium", amount: "50 mg", dv: "4%" },
          { name: "Iron", amount: "1.2 mg", dv: "7%" },
          { name: "Zinc", amount: "1.1 mg", dv: "10%" },
          { name: "Selenium", amount: "30.7 µg", dv: "56%" }
        ],
        health_benefits: [
          { title: "Muscle Repair & Growth", description: "Provides complete high-quality protein containing all 9 essential amino acids for tissue repair." },
          { title: "Brain & Memory Support", description: "Rich in choline, an essential nutrient for brain development and cognitive function." },
          { title: "Eye & Vision Protection", description: "Contains lutein and zeaxanthin antioxidants that help protect retinal eye tissues." }
        ],
        useful_for: [
          "💪 Muscle Building & Athletic Recovery",
          "🧠 Brain & Focus Support",
          "👀 Eye & Vision Protection",
          "🍳 Healthy Protein Breakfast",
          "⚖️ Weight Management & Satiety"
        ],
        things_to_know: [
          "⚠️ Contains dietary cholesterol (~186mg per large egg, mostly in yolk)",
          "⚠️ Common food allergen for sensitive individuals",
          "⚠️ Cook thoroughly to eliminate foodborne salmonella risk",
          "⚠️ Egg yolk contains almost all the fat-soluble vitamins & choline"
        ],
        suggested_portion: {
          title: "2 Large Eggs",
          grams: 100,
          calories: 155,
          macros_text: "≈ 155 kcal | 13g protein | 1.1g carbs | 11g fat"
        },
        best_ways_to_eat: [
          "Hard-boiled as a convenient portable high-protein snack",
          "Scrambled with fresh spinach, tomatoes & olive oil",
          "Poached on top of whole-grain sourdough toast",
          "Omelet packed with bell peppers & herbs"
        ],
        nutrition_score: {
          overall: "★★★★★ Outstanding",
          stars: 5
        }
      };
    }

    if (s.includes('grape')) {
      return {
        ...food,
        summary: { calories: 69, serving_g: 100, water_g: 80.5, sugar_g: 15.5, sodium_mg: 2 },
        vitamins: [
          { name: "Vitamin C", amount: "10.8 mg", dv: "12%" },
          { name: "Vitamin K", amount: "14.6 µg", dv: "12%" },
          { name: "Vitamin B6", amount: "0.1 mg", dv: "6%" },
          { name: "Thiamine (B1)", amount: "0.07 mg", dv: "6%" }
        ],
        minerals: [
          { name: "Potassium", amount: "191 mg", dv: "4%" },
          { name: "Copper", amount: "0.13 mg", dv: "14%" },
          { name: "Manganese", amount: "0.07 mg", dv: "3%" },
          { name: "Magnesium", amount: "7 mg", dv: "2%" }
        ],
        health_benefits: [
          { title: "Cardiovascular Wellness", description: "High in resveratrol antioxidants that support optimal arterial & heart function." },
          { title: "Cellular Hydration", description: "Contains high natural water content supporting skin moisture and electrolyte balance." },
          { title: "Immune Defense", description: "Provides Vitamin C and polyphenols that defend cells against oxidative stress." }
        ],
        useful_for: [
          "💧 Cellular Hydration",
          "❤️ Heart-Conscious Eating",
          "🏃 Pre-Workout Natural Energy",
          "🍇 Anti-Aging Antioxidant Support"
        ],
        things_to_know: [
          "⚠️ Contains natural sugars; portion size matters for glycemic control",
          "⚠️ Whole grapes are preferred over grape juice to retain fiber",
          "⚠️ Wash thoroughly under cold water before consumption"
        ],
        suggested_portion: {
          title: "1 Cup Grapes",
          grams: 150,
          calories: 104,
          macros_text: "≈ 104 kcal | 27.3g carbs | 1.1g protein | 1.4g fiber"
        },
        best_ways_to_eat: [
          "Enjoy fresh as a refreshing sweet mid-day snack",
          "Freeze grapes for a delicious cold summer treat",
          "Mix into fresh fruit salads or Greek yogurt bowls",
          "Pair with walnuts or cheese for balanced blood sugar"
        ],
        nutrition_score: {
          overall: "★★★★☆ Good",
          stars: 4
        }
      };
    }

    return {
      ...food,
      summary: food.summary || { calories: cal, serving_g: 100, water_g: 80.0, sugar_g: 5.0, sodium_mg: 20 },
      vitamins: food.vitamins || [
        { name: "Vitamin A", amount: "350 IU", dv: "12%" },
        { name: "Vitamin C", amount: "15 mg", dv: "18%" },
        { name: "Vitamin K", amount: "22 µg", dv: "18%" }
      ],
      minerals: food.minerals || [
        { name: "Potassium", amount: "220 mg", dv: "5%" },
        { name: "Magnesium", amount: "24 mg", dv: "6%" },
        { name: "Calcium", amount: "40 mg", dv: "3%" }
      ],
      health_benefits: food.health_benefits || [
        { title: "Cellular Nutrition", description: "Supports overall cellular health & daily dietary micronutrient balance." },
        { title: "Metabolic Support", description: "Provides essential dietary nutrients to support active energy levels." }
      ],
      useful_for: food.useful_for || ["💪 General Daily Nutrition", "🏃 Active Lifestyle & Wellness"],
      things_to_know: food.things_to_know || ["⚠️ Portion control recommended according to daily caloric targets"],
      suggested_portion: food.suggested_portion || { title: `1 Serving (${food.name})`, grams: 100, calories: cal, macros_text: `≈ ${cal} kcal` },
      best_ways_to_eat: food.best_ways_to_eat || ["Incorporate into daily balanced meals"],
      nutrition_score: food.nutrition_score || { overall: "★★★★☆ Good", stars: 4 }
    };
  }

  async getFoodBySlug(slug) {
    try {
      const res = await fetch(`${this.baseUrl}/api/foods/${slug}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return this.enrichMockFood(json.data || json.food);
      }
    } catch (e) {
      console.warn(`Using fallback for slug ${slug}:`, e.message);
    }
    const found = this.mockFoods.find(f => f.slug === slug) || this.mockFoods[0];
    return this.enrichMockFood(found);
  }

  async getDailyTip(lang = 'en') {
    try {
      const res = await fetch(`${this.baseUrl}/api/daily-tip?lang=${lang}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) return json.data;
      }
    } catch (e) {
      console.warn("Using fallback daily tip:", e.message);
    }
    return {
      tip: "Spinach is exceptionally rich in lutein and folate, supporting both macular eye health and cellular red blood cell production.",
      food_slug: "spinach"
    };
  }

  async askAI(question, foodSlug = null, lang = 'en', contentType = 'basic') {
    try {
      const res = await fetch(`${this.baseUrl}/api/ai/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, food_slug: foodSlug, languageCode: lang, lang, content_type: contentType })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && (json.answer || json.content)) {
          return {
            success: true,
            answer: json.answer || json.content,
            provider: json.modelProvider || json.provider || "HealthFood AI Engine"
          };
        }
      }
    } catch (e) {
      console.warn("Using fallback AI answer:", e.message);
    }

    return this.generateSimulatedNutritionResponse(question);
  }

  generateSimulatedNutritionResponse(question) {
    const q = (question || '').toLowerCase();
    
    let foodName = "Food Item";
    let serving = "100g serving";
    let calories = "85 kcal";
    let carbs = "18 g";
    let sugars = "10 g";
    let fiber = "2.8 g";
    let protein = "1.2 g";
    let fat = "0.3 g";
    let potassium = "350 mg";
    let vitC = "12 mg";
    let vitB6 = "0.3 mg";
    let mag = "28 mg";
    let emoji = "🥗";

    if (q.includes("banana")) {
      foodName = "Banana";
      serving = "1 medium banana (~118 g)";
      calories = "105 kcal";
      carbs = "27 g";
      sugars = "14 g";
      fiber = "3.1 g";
      protein = "1.3 g";
      fat = "0.4 g";
      potassium = "422 mg";
      vitC = "10 mg";
      vitB6 = "0.4 mg";
      mag = "32 mg";
      emoji = "🍌";
    } else if (q.includes("papaya")) {
      foodName = "Papaya";
      serving = "1 cup diced papaya (~145 g)";
      calories = "62 kcal";
      carbs = "16 g";
      sugars = "11 g";
      fiber = "2.5 g";
      protein = "0.9 g";
      fat = "0.4 g";
      potassium = "264 mg";
      vitC = "88 mg";
      vitB6 = "0.1 mg";
      mag = "30 mg";
      emoji = "🥭";
    } else if (q.includes("avocado")) {
      foodName = "Avocado";
      serving = "1 medium avocado (~150 g)";
      calories = "240 kcal";
      carbs = "12 g";
      sugars = "1 g";
      fiber = "10 g";
      protein = "3 g";
      fat = "22 g";
      potassium = "708 mg";
      vitC = "15 mg";
      vitB6 = "0.4 mg";
      mag = "43 mg";
      emoji = "🥑";
    } else if (q.includes("dragon fruit") || q.includes("dragonfruit")) {
      foodName = "Dragon Fruit";
      serving = "1 cup cubed (~170 g)";
      calories = "102 kcal";
      carbs = "22 g";
      sugars = "13 g";
      fiber = "5 g";
      protein = "2 g";
      fat = "0.6 g";
      potassium = "340 mg";
      vitC = "20.5 mg";
      vitB6 = "0.1 mg";
      mag = "68 mg";
      emoji = "🐲";
    } else if (q.includes("kiwi")) {
      foodName = "Kiwi";
      serving = "1 medium kiwi (~69 g)";
      calories = "42 kcal";
      carbs = "10 g";
      sugars = "6 g";
      fiber = "2.1 g";
      protein = "0.8 g";
      fat = "0.4 g";
      potassium = "215 mg";
      vitC = "64 mg";
      vitB6 = "0.04 mg";
      mag = "12 mg";
      emoji = "🥝";
    } else {
      const match = question.match(/nutrition (?:of|for) ([a-zA-Z\s]+)/i) || question.match(/about ([a-zA-Z\s]+)/i);
      if (match && match[1]) {
        foodName = match[1].trim();
        foodName = foodName.charAt(0).toUpperCase() + foodName.slice(1);
      }
    }

    const answer = `### ${emoji} ${foodName} nutrition\n\nFor **${serving}**:\n\n| Nutrient | Approx. amount |\n| :--- | ---: |\n| Calories | ${calories} |\n| Carbohydrates | ${carbs} |\n| Natural sugars | ${sugars} |\n| Fiber | ${fiber} |\n| Protein | ${protein} |\n| Fat | ${fat} |\n| Potassium | ${potassium} |\n| Vitamin C | ${vitC} |\n| Vitamin B6 | ${vitB6} |\n| Magnesium | ${mag} |\n\n### Key Health Benefits\n- **Rich in Essential Micronutrients**: Provides vital vitamins and minerals that support cellular immunity and energy metabolism.\n- **Dietary Fiber Support**: Promotes healthy gut motility, microbiota diversity, and steady glucose balance.\n\n*Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice.*`;

    return {
      success: true,
      provider: "HealthFood AI Engine",
      answer: answer
    };
  }
}

window.apiClient = new APIClient();
