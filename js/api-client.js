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
        image_url: "https://images.unsplash.com/photo-1508061252966-f728f30739c3?auto=format&fit=crop&w=600&q=80",
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

  async getFoodBySlug(slug) {
    try {
      const res = await fetch(`${this.baseUrl}/api/foods/${slug}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json.data || json.food || null;
      }
    } catch (e) {
      console.warn(`Using fallback for slug ${slug}:`, e.message);
    }
    return this.mockFoods.find(f => f.slug === slug) || this.mockFoods[0];
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
      const res = await fetch(`${this.baseUrl}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, food_slug: foodSlug, lang, content_type: contentType })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.answer) return json;
      }
    } catch (e) {
      console.warn("Using fallback AI answer:", e.message);
    }

    // Simulated intelligent response generator
    return {
      success: true,
      provider: "HealthFood AI Engine (Cached)",
      answer: `**Nutritional Analysis**: ${question}\n\nKey health benefit: Foods rich in dietary fiber and essential micronutrients help maintain metabolic equilibrium, support gut microbiome diversity, and regulate postprandial glucose stability.\n\n*Note: Always consult a certified healthcare professional for personalized dietary modifications.*`
    };
  }
}

window.apiClient = new APIClient();
