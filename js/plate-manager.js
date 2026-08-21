/**
 * PlateManager for HealthFood AI
 * Manages client-side meal plate state, food-specific portion calculations,
 * and localStorage persistence ('healthfood_plate').
 */
class PlateManager {
  constructor(storageKey = 'healthfood_plate') {
    this.storageKey = storageKey;
    this.items = [];
    this.listeners = [];
    this.load();
  }

  /**
   * Load saved plate state from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items)) {
          this.items = parsed.items;
        }
      }
    } catch (err) {
      console.warn('PlateManager: Failed to load from localStorage', err);
      this.items = [];
    }
  }

  /**
   * Persist current plate state to localStorage and trigger listeners
   */
  save() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          items: this.items,
          updatedAt: new Date().toISOString()
        })
      );
    } catch (err) {
      console.warn('PlateManager: Failed to save to localStorage', err);
    }
    this.notify();
  }

  /**
   * Subscribe a callback to plate state updates
   */
  onChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notify() {
    const totals = this.getTotals();
    this.listeners.forEach((cb) => cb(this.items, totals));
  }

  /**
   * Calculate scaled nutrient values for a food item and selected grams
   * Formula: scaled_nutrient = (100g_nutrient * selected_grams) / 100
   */
  calculateScaledNutrition(macronutrients, baseGrams, selectedGrams) {
    if (!macronutrients) {
      return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
    }

    // Safety checks for gram values
    const safeSelectedGrams = Math.max(0, Math.min(2000, Number(selectedGrams) || 0));
    
    const factor = safeSelectedGrams / 100;

    const cal = Number(macronutrients.calories) || 0;
    const pro = Number(macronutrients.protein_g ?? macronutrients.protein) || 0;
    const carb = Number(macronutrients.carbs_g ?? macronutrients.carbs ?? macronutrients.carbohydrates_g) || 0;
    const fat = Number(macronutrients.fat_g ?? macronutrients.fat) || 0;
    const fib = Number(macronutrients.fiber_g ?? macronutrients.fiber) || 0;

    return {
      calories: Math.round(cal * factor),
      protein_g: Number((pro * factor).toFixed(1)),
      carbs_g: Number((carb * factor).toFixed(1)),
      fat_g: Number((fat * factor).toFixed(1)),
      fiber_g: Number((fib * factor).toFixed(1))
    };
  }

  /**
   * Add a food item to the plate or update its portion if already exists
   */
  addItem(food, initialGrams = null) {
    if (!food || (!food.id && !food.slug)) return;

    const foodId = food.id || food.slug;
    const existingIndex = this.items.findIndex((item) => item.foodId === foodId || item.slug === food.slug);
    const defaultGrams = initialGrams || food.serving_size_g || 100;

    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      const newGrams = existing.grams + defaultGrams;
      this.updatePortion(foodId, newGrams);
      return;
    }

    const rawMacros = food.macronutrients || {};
    const scaled = this.calculateScaledNutrition(rawMacros, food.serving_size_g || 100, defaultGrams);

    const newItem = {
      foodId: foodId,
      slug: food.slug,
      name: food.name,
      categoryName: food.category_name || 'Food',
      baseGrams: 100,
      servingGrams: food.serving_size_g || 100,
      grams: defaultGrams,
      rawMacronutrients: rawMacros,
      scaledNutrition: scaled
    };

    this.items.push(newItem);
    this.save();
  }

  /**
   * Update portion grams for a specific food item
   */
  updatePortion(foodId, newGrams) {
    const safeGrams = Math.max(0, Math.min(2000, Number(newGrams) || 0));

    if (safeGrams === 0) {
      this.removeItem(foodId);
      return;
    }

    const item = this.items.find((i) => i.foodId === foodId || i.slug === foodId);
    if (!item) return;

    item.grams = safeGrams;
    item.scaledNutrition = this.calculateScaledNutrition(item.rawMacronutrients, item.servingGrams, safeGrams);
    this.save();
  }

  /**
   * Remove item from plate
   */
  removeItem(foodId) {
    this.items = this.items.filter((i) => i.foodId !== foodId && i.slug !== foodId);
    this.save();
  }

  /**
   * Clear all items from plate
   */
  clearPlate() {
    this.items = [];
    this.save();
  }

  /**
   * Get all current items
   */
  getItems() {
    return this.items;
  }

  /**
   * Calculate aggregated totals for the whole meal plate
   */
  getTotals() {
    return this.items.reduce(
      (totals, item) => {
        const n = item.scaledNutrition;
        totals.calories += n.calories || 0;
        totals.protein_g += n.protein_g || 0;
        totals.carbs_g += n.carbs_g || 0;
        totals.fat_g += n.fat_g || 0;
        totals.fiber_g += n.fiber_g || 0;
        totals.totalGrams += item.grams || 0;
        return totals;
      },
      {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        totalGrams: 0,
        itemCount: this.items.length
      }
    );
  }
}

// Make globally available
if (typeof window !== 'undefined') {
  window.PlateManager = PlateManager;
  window.plateManager = new PlateManager();
}
