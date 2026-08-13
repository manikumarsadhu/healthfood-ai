/**
 * Food UI Renderer for HealthFood AI
 * Renders food card grid and detail drawer modals.
 */
class FoodRenderer {
  constructor() {
    this.foodGridEl = document.getElementById('food-grid');
    this.detailDrawerEl = document.getElementById('detail-drawer');
    this.modalBackdropEl = document.getElementById('modal-backdrop');
    this.currentFood = null;
  }

  renderGrid(foods) {
    if (!this.foodGridEl) return;

    if (!foods || foods.length === 0) {
      this.foodGridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🥗</div>
          <p data-i18n="no_results">No foods found matching your query.</p>
        </div>
      `;
      return;
    }

    this.foodGridEl.innerHTML = foods.map(food => {
      const macros = food.macronutrients || {};
      const isVeg = food.vegetarian !== false;
      const vegBadgeHtml = isVeg 
        ? `<span class="badge-veg">🌱 ${window.languageManager?.t('veg_badge', 'Vegetarian')}</span>`
        : `<span class="badge-nonveg">🍖 ${window.languageManager?.t('non_veg_badge', 'Non-Veg')}</span>`;

      return `
        <div class="food-card" onclick="window.foodRenderer.openDetail('${food.slug}')">
          <div class="food-card-header" style="background-image: url('${food.image_url || ''}')">
            <div class="food-card-overlay">
              ${vegBadgeHtml}
              <span style="background: rgba(0,0,0,0.7); color: #fff; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
                🔥 ${macros.calories || 0} cal
              </span>
            </div>
          </div>
          <div class="food-card-body">
            <h3 class="food-card-title">${food.name}</h3>
            <p class="food-card-subtitle">${food.canonical_name || food.category_name}</p>
            <div class="macro-mini-meter">
              <div class="macro-mini-item">
                <div class="macro-mini-label" style="color: var(--macro-protein)">PRO</div>
                <div class="macro-mini-value">${macros.protein_g || 0}g</div>
              </div>
              <div class="macro-mini-item">
                <div class="macro-mini-label" style="color: var(--macro-carbs)">CARB</div>
                <div class="macro-mini-value">${macros.carbs_g || 0}g</div>
              </div>
              <div class="macro-mini-item">
                <div class="macro-mini-label" style="color: var(--macro-fat)">FAT</div>
                <div class="macro-mini-value">${macros.fat_g || 0}g</div>
              </div>
              <div class="macro-mini-item">
                <div class="macro-mini-label" style="color: var(--macro-fiber)">FIBER</div>
                <div class="macro-mini-value">${macros.fiber_g || 0}g</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async openDetail(slug) {
    const food = await window.apiClient.getFoodBySlug(slug);
    if (!food) return;
    this.currentFood = food;

    const macros = food.macronutrients || {};
    const micros = food.micronutrients || [];
    const benefits = food.health_benefits || [];

    document.getElementById('drawer-title').textContent = food.name;
    document.getElementById('drawer-subtitle').textContent = `${food.canonical_name || ''} • ${food.serving_size_g || 100}g serving`;
    document.getElementById('drawer-desc').textContent = food.description || '';

    // Macros full view
    const macrosEl = document.getElementById('drawer-macros');
    if (macrosEl) {
      macrosEl.innerHTML = `
        <div class="macro-card-full">
          <div class="macro-card-header">
            <span class="macro-name" style="color: var(--macro-protein)">Protein</span>
            <span class="macro-val">${macros.protein_g || 0}g</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(100, (macros.protein_g || 0) * 3)}%; background: var(--macro-protein)"></div>
          </div>
        </div>
        <div class="macro-card-full">
          <div class="macro-card-header">
            <span class="macro-name" style="color: var(--macro-carbs)">Carbohydrates</span>
            <span class="macro-val">${macros.carbs_g || 0}g</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(100, (macros.carbs_g || 0) * 2)}%; background: var(--macro-carbs)"></div>
          </div>
        </div>
        <div class="macro-card-full">
          <div class="macro-card-header">
            <span class="macro-name" style="color: var(--macro-fat)">Fat</span>
            <span class="macro-val">${macros.fat_g || 0}g</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(100, (macros.fat_g || 0) * 4)}%; background: var(--macro-fat)"></div>
          </div>
        </div>
        <div class="macro-card-full">
          <div class="macro-card-header">
            <span class="macro-name" style="color: var(--macro-fiber)">Fiber</span>
            <span class="macro-val">${macros.fiber_g || 0}g</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(100, (macros.fiber_g || 0) * 10)}%; background: var(--macro-fiber)"></div>
          </div>
        </div>
      `;
    }

    // Micros view
    const microsEl = document.getElementById('drawer-micros');
    if (microsEl) {
      microsEl.innerHTML = micros.map(m => `
        <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
          <span style="font-weight: 500;">${m.name}</span>
          <span style="color: var(--primary); font-weight: 600;">${m.amount} (${m.dv_percentage}% DV)</span>
        </div>
      `).join('');
    }

    // Benefits view
    const benefitsEl = document.getElementById('drawer-benefits');
    if (benefitsEl) {
      benefitsEl.innerHTML = benefits.map(b => `
        <div class="benefit-pill">
          <div class="benefit-title">✨ ${b.title}</div>
          <div class="benefit-desc">${b.description}</div>
        </div>
      `).join('');
    }

    // Inject Schema.org NutritionInformation JSON-LD
    this.injectNutritionSchema(food);

    // Open drawer
    this.detailDrawerEl.classList.add('open');
    this.modalBackdropEl.classList.add('open');
  }

  injectNutritionSchema(food) {
    const macros = food.macronutrients || {};
    let schemaScript = document.getElementById('schema-nutrition');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.id = 'schema-nutrition';
      document.head.appendChild(schemaScript);
    }

    const schemaData = {
      "@context": "https://schema.org",
      "@type": "NutritionInformation",
      "name": food.name,
      "servingSize": `${food.serving_size_g || 100} g`,
      "calories": `${macros.calories || 0} calories`,
      "proteinContent": `${macros.protein_g || 0} g`,
      "carbohydrateContent": `${macros.carbs_g || 0} g`,
      "fatContent": `${macros.fat_g || 0} g`,
      "fiberContent": `${macros.fiber_g || 0} g`
    };

    schemaScript.textContent = JSON.stringify(schemaData, null, 2);
  }

  closeDetail() {
    if (this.detailDrawerEl) this.detailDrawerEl.classList.remove('open');
    if (this.modalBackdropEl) this.modalBackdropEl.classList.remove('open');
  }
}

window.foodRenderer = new FoodRenderer();
