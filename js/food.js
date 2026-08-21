/**
 * Food UI Renderer for HealthFood AI
 * Renders food card grid, detail drawer modals, and meal plate drawer.
 */
class FoodRenderer {
  constructor() {
    this.foodGridEl = document.getElementById('food-grid');
    this.detailDrawerEl = document.getElementById('detail-drawer');
    this.plateDrawerEl = document.getElementById('plate-drawer');
    this.modalBackdropEl = document.getElementById('modal-backdrop');

    this.plateBarEl = document.getElementById('plate-bar');
    this.plateCountBadgeEl = document.getElementById('plate-count-badge');
    this.plateSummaryTextEl = document.getElementById('plate-summary-text');
    this.plateTotalsCardEl = document.getElementById('plate-totals-card');
    this.plateItemsListEl = document.getElementById('plate-items-list');

    this.currentFood = null;
    this.selectedDetailGrams = 100;

    this.initPlateListener();
  }

  initPlateListener() {
    if (window.plateManager) {
      window.plateManager.onChange((items, totals) => this.renderPlateUI(items, totals));
      // Initial render
      this.renderPlateUI(window.plateManager.getItems(), window.plateManager.getTotals());
    }
  }

  renderPlateUI(items, totals) {
    // 1. Sticky bottom bar update
    if (this.plateBarEl) {
      if (items.length > 0) {
        this.plateBarEl.classList.add('visible');
      } else {
        this.plateBarEl.classList.remove('visible');
        this.closePlateModal();
      }
    }

    if (this.plateCountBadgeEl) {
      this.plateCountBadgeEl.textContent = items.length;
    }

    if (this.plateSummaryTextEl) {
      this.plateSummaryTextEl.textContent = `${totals.calories} kcal • ${totals.protein_g}g Pro • ${totals.carbs_g}g Carb • ${totals.fat_g}g Fat`;
    }

    // 2. Plate Drawer totals view
    if (this.plateTotalsCardEl) {
      this.plateTotalsCardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">TOTAL MEAL CALORIES</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--primary);">🔥 ${totals.calories} <small style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">kcal</small></div>
          </div>
          <button class="secondary-btn" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;" onclick="window.plateManager.clearPlate()">Clear All</button>
        </div>
        <div class="plate-totals-grid">
          <div class="plate-totals-item">
            <div class="plate-totals-val" style="color: var(--macro-protein);">${totals.protein_g}g</div>
            <div class="plate-totals-lbl">Protein</div>
          </div>
          <div class="plate-totals-item">
            <div class="plate-totals-val" style="color: var(--macro-carbs);">${totals.carbs_g}g</div>
            <div class="plate-totals-lbl">Carbs</div>
          </div>
          <div class="plate-totals-item">
            <div class="plate-totals-val" style="color: var(--macro-fat);">${totals.fat_g}g</div>
            <div class="plate-totals-lbl">Fat</div>
          </div>
          <div class="plate-totals-item">
            <div class="plate-totals-val" style="color: var(--macro-fiber);">${totals.fiber_g}g</div>
            <div class="plate-totals-lbl">Fiber</div>
          </div>
        </div>
      `;
    }

    // 3. Plate Drawer itemized list
    if (this.plateItemsListEl) {
      if (items.length === 0) {
        this.plateItemsListEl.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
            Your meal plate is currently empty. Browse foods and tap "Add to My Plate" to build your meal!
          </div>
        `;
      } else {
        this.plateItemsListEl.innerHTML = items.map((item) => {
          const n = item.scaledNutrition;
          return `
            <div class="plate-item-row">
              <div class="plate-item-info">
                <div class="plate-item-name">${item.name}</div>
                <div class="plate-item-macros">
                  🔥 ${n.calories} kcal • ${n.protein_g}g P • ${n.carbs_g}g C • ${n.fat_g}g F
                </div>
              </div>
              <div class="plate-item-controls">
                <select class="select-control" style="padding: 0.3rem 0.5rem; font-size: 0.8rem;" onchange="window.plateManager.updatePortion(${item.foodId}, this.value)">
                  <option value="${Math.round(item.servingGrams * 0.5)}" ${item.grams === Math.round(item.servingGrams * 0.5) ? 'selected' : ''}>½ Serving (${Math.round(item.servingGrams * 0.5)}g)</option>
                  <option value="${item.servingGrams}" ${item.grams === item.servingGrams ? 'selected' : ''}>1 Serving (${item.servingGrams}g)</option>
                  <option value="${item.servingGrams * 2}" ${item.grams === item.servingGrams * 2 ? 'selected' : ''}>2 Servings (${item.servingGrams * 2}g)</option>
                  <option value="150" ${item.grams === 150 ? 'selected' : ''}>1 Katori (150g)</option>
                  <option value="200" ${item.grams === 200 ? 'selected' : ''}>1 Cup (200g)</option>
                  <option value="250" ${item.grams === 250 ? 'selected' : ''}>1 Glass (250ml)</option>
                </select>
                <button class="icon-btn" style="color: var(--macro-fat); font-size: 1.1rem; padding: 0.3rem;" onclick="window.plateManager.removeItem(${item.foodId})" title="Remove item">✕</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  renderSkeletonGrid(count = 8) {
    if (!this.foodGridEl) return;
    this.foodGridEl.setAttribute('aria-busy', 'true');
    const skeletons = Array(count).fill(0).map(() => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-box skeleton-image"></div>
        <div class="skeleton-body">
          <div class="skeleton-box skeleton-title"></div>
          <div class="skeleton-box skeleton-subtitle"></div>
          <div class="skeleton-badge-group">
            <div class="skeleton-box skeleton-badge"></div>
            <div class="skeleton-box skeleton-badge"></div>
          </div>
        </div>
      </div>
    `).join('');
    this.foodGridEl.innerHTML = skeletons;
  }

  renderGrid(foods) {
    if (!this.foodGridEl) return;
    this.foodGridEl.removeAttribute('aria-busy');

    if (!foods || foods.length === 0) {
      const inputVal = document.getElementById('search-input')?.value.trim() || '';
      const q = inputVal || window.currentSearchQuery || '';

      const buttonLabel = q ? `Ask AI Assistant about "${q}"` : 'Ask AI Assistant';
      const aiPrompt = q
        ? `Tell me about the nutritional facts and health benefits of ${q.replace(/'/g, "\\'")}`
        : `What are the health benefits and nutrition facts of the food item I am looking for?`;

      this.foodGridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); background: var(--card-bg); border: 1px dashed var(--border-color); border-radius: 14px; margin: 1rem 0;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🥑</div>
          <h3 style="color: var(--text-color); margin-bottom: 0.4rem; font-size: 1.2rem;">No exact catalog match for "${q || 'this item'}"</h3>
          <p style="font-size: 0.95rem; max-width: 480px; margin: 0 auto; color: var(--text-muted);" data-i18n="no_results">
            We don't have a verified database entry for this food yet. You can consult our AI Assistant for an instant AI nutritional breakdown!
          </p>
          <div style="margin-top: 1.25rem;">
            <button style="background: linear-gradient(135deg, var(--primary), #059669); color: #fff; border: none; padding: 0.8rem 1.6rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);" onclick="window.chatbotController.openChat('${aiPrompt.replace(/'/g, "\\'")}')">
              <span>🤖</span>
              <span>${buttonLabel}</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    const activeGoal = window.healthGoalsEngine?.getGoal() || 'general';

    this.foodGridEl.innerHTML = foods.map((food) => {
      const macros = food.macronutrients || {};
      const isVeg = food.vegetarian !== false;
      const vegBadgeHtml = isVeg
        ? `<span class="badge-veg">🌱 ${window.languageManager?.t('veg_badge', 'Vegetarian')}</span>`
        : `<span class="badge-nonveg">🍖 ${window.languageManager?.t('non_veg_badge', 'Non-Veg')}</span>`;

      // Evaluate against active health goal
      const evaluation = window.healthGoalsEngine?.evaluateFood(food, activeGoal) || {};
      const goalBadgeHtml = evaluation.badgeText && activeGoal !== 'general'
        ? `<div class="${evaluation.status ? 'status-' + evaluation.status : ''}" style="margin-top: 0.4rem; font-size: 0.75rem;">${evaluation.badgeText}</div>`
        : '';

      const defaultImg = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80';
      const imgUrl = food.image_url || defaultImg;

      return `
        <div class="food-card" onclick="window.foodRenderer.openDetail('${food.slug}')">
          <div class="food-card-header" style="background-image: url('${imgUrl}')">
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
            ${goalBadgeHtml}
            <div class="macro-mini-meter" style="margin-top: 0.6rem;">
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
    this.selectedDetailGrams = food.serving_size_g || 100;

    const macros = food.macronutrients || {};
    const micros = food.micronutrients || [];

    document.getElementById('drawer-title').textContent = food.name;
    document.getElementById('drawer-subtitle').textContent = `${food.canonical_name || ''} • ${food.serving_size_g || 100}g serving`;
    document.getElementById('drawer-desc').textContent = food.description || '';

    // Render Health Goal Evaluation Badge in Detail Drawer
    const activeGoal = window.healthGoalsEngine?.getGoal() || 'general';
    const evaluation = window.healthGoalsEngine?.evaluateFood(food, activeGoal);
    const healthBadgeEl = document.getElementById('drawer-health-badge');

    if (healthBadgeEl) {
      if (activeGoal !== 'general' && evaluation && evaluation.badgeText) {
        healthBadgeEl.innerHTML = `
          <div class="status-${evaluation.status || 'neutral'}" style="padding: 0.75rem; border-radius: 10px;">
            <div style="font-size: 0.9rem; font-weight: 700;">${evaluation.badgeText}</div>
            ${evaluation.reasons ? `<ul style="margin: 0.35rem 0 0 1rem; font-size: 0.8rem;">${evaluation.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
            ${evaluation.recommendation ? `<div style="font-size: 0.8rem; margin-top: 0.35rem; font-weight: 500;">💡 ${evaluation.recommendation}</div>` : ''}
          </div>
        `;
      } else {
        healthBadgeEl.innerHTML = '';
      }
    }

    // 1. Summary Header
    const summaryEl = document.getElementById('drawer-summary');
    if (summaryEl) {
      const summary = food.summary || { calories: macros.calories || 100, serving_g: 100, water_g: 80, sugar_g: 5, sodium_mg: 20 };
      const score = food.nutrition_score || { overall: '★★★★☆ Good', stars: 4 };
      summaryEl.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 1.6rem; font-weight: 700; color: var(--primary);">🔥 ${summary.calories || macros.calories || 0}</span>
              <span style="font-size: 0.85rem; color: var(--text-muted);"> kcal / ${summary.serving_g || 100}g</span>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">NUTRITION SCORE</div>
              <div style="font-size: 0.9rem; color: var(--primary); font-weight: 700;">${score.overall || '★★★★☆'}</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; text-align: center; background: rgba(0,0,0,0.2); padding: 0.6rem; border-radius: 8px; font-size: 0.8rem;">
            <div>💧 Water: <strong>${summary.water_g || 80}g</strong></div>
            <div>🍬 Sugar: <strong>${summary.sugar_g || 2}g</strong></div>
            <div>🧂 Sodium: <strong>${summary.sodium_mg || 10}mg</strong></div>
          </div>
        </div>
      `;
    }

    // 2. Macros full view
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

    // 3. Micros (Vitamins & Minerals) view
    const microsEl = document.getElementById('drawer-micros');
    if (microsEl) {
      const vitamins = food.vitamins || [
        { name: 'Vitamin A', amount: '540 IU', dv: '18%' },
        { name: 'Vitamin C', amount: '10.8 mg', dv: '12%' },
        { name: 'Vitamin B12', amount: '0.9 µg', dv: '38%' }
      ];
      const minerals = food.minerals || [
        { name: 'Potassium', amount: '191 mg', dv: '4%' },
        { name: 'Phosphorus', amount: '198 mg', dv: '20%' },
        { name: 'Iron', amount: '1.2 mg', dv: '7%' }
      ];

      microsEl.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem; font-size: 0.88rem;">
          <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.4rem; font-size: 0.8rem; text-transform: uppercase;">Vitamins</div>
          ${vitamins.map((v) => `
            <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>${v.name}</span>
              <span style="font-weight: 600; color: var(--text-color);">${v.amount} <small style="color: var(--text-muted);">(${v.dv || (v.dv_percentage ? v.dv_percentage + '%' : '')})</small></span>
            </div>
          `).join('')}
          <div style="font-weight: 600; color: var(--primary); margin: 0.8rem 0 0.4rem 0; font-size: 0.8rem; text-transform: uppercase;">Minerals</div>
          ${minerals.map((m) => `
            <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>${m.name}</span>
              <span style="font-weight: 600; color: var(--text-color);">${m.amount} <small style="color: var(--text-muted);">(${m.dv || (m.dv_percentage ? m.dv_percentage + '%' : '')})</small></span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 4. Benefits view
    const benefitsEl = document.getElementById('drawer-benefits');
    if (benefitsEl) {
      const benefits = food.health_benefits || ['Supports immune defense', 'Provides essential daily antioxidants'];
      benefitsEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          ${(Array.isArray(benefits) ? benefits : []).map((b) => {
            const title = typeof b === 'string' ? b : (b.title || b.name || 'Health Benefit');
            const desc = typeof b === 'string' ? '' : (b.description || '');
            return `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.85rem;">
                <div style="font-weight: 600; color: var(--primary); display: flex; align-items: center; gap: 0.3rem;">
                  <span class="material-symbols-outlined" style="font-size: 0.95rem;">favorite</span> ${title}
                </div>
                ${desc ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${desc}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 5. Useful For
    const usefulEl = document.getElementById('drawer-useful-for');
    if (usefulEl) {
      const useful = food.useful_for || ['💪 Muscle Building', '🏃 Active Lifestyle', '❤️ Heart Health'];
      usefulEl.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
          ${useful.map((u) => `
            <span style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--primary); padding: 0.35rem 0.7rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">${u}</span>
          `).join('')}
        </div>
      `;
    }

    // 6. Things to Know
    const thingsEl = document.getElementById('drawer-things-to-know');
    if (thingsEl) {
      const things = food.things_to_know || ['⚠️ Portion control recommended according to daily caloric targets'];
      thingsEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          ${things.map((t) => `
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.83rem; color: #f59e0b;">${t}</div>
          `).join('')}
        </div>
      `;
    }

    // 7. Portion Recommendation
    const portionEl = document.getElementById('drawer-portion');
    if (portionEl) {
      const p = food.suggested_portion || { title: `1 Serving (${food.name})`, grams: 100, calories: macros.calories || 100, macros_text: `≈ ${macros.calories || 100} kcal` };
      portionEl.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem; font-size: 0.88rem;">
          <div style="font-weight: 700; color: var(--text-color); margin-bottom: 0.25rem;">🍽️ ${p.title} (≈ ${p.grams}g)</div>
          <div style="color: var(--primary); font-weight: 600; font-size: 0.85rem;">${p.macros_text || `≈ ${p.calories} kcal`}</div>
        </div>
      `;
    }

    // 8. Easy Ways to Eat
    const waysEl = document.getElementById('drawer-ways-to-eat');
    if (waysEl) {
      const ways = food.best_ways_to_eat || ['Enjoy fresh as a healthy daily snack', 'Mix into salads or morning breakfast bowl'];
      waysEl.innerHTML = `
        <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.85rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.35rem;">
          ${ways.map((w) => `<li>${w}</li>`).join('')}
        </ul>
      `;
    }

    // Inject Schema.org NutritionInformation JSON-LD
    this.injectNutritionSchema(food);

    // Open drawer
    this.detailDrawerEl.classList.add('open');
    this.modalBackdropEl.classList.add('open');
  }

  handleDetailPortionChange(grams) {
    this.selectedDetailGrams = Number(grams) || 100;
  }

  addCurrentToPlate() {
    if (!this.currentFood || !window.plateManager) return;
    window.plateManager.addItem(this.currentFood, this.selectedDetailGrams);
    if (window.notificationManager) {
      window.notificationManager.showToast(`Added ${this.currentFood.name} (${this.selectedDetailGrams}g) to My Meal Plate!`, 'success');
    }
  }

  openPlateModal() {
    if (this.plateDrawerEl) this.plateDrawerEl.classList.add('open');
    if (this.modalBackdropEl) this.modalBackdropEl.classList.add('open');
  }

  closePlateModal() {
    if (this.plateDrawerEl) this.plateDrawerEl.classList.remove('open');
    if (this.modalBackdropEl && !this.detailDrawerEl?.classList.contains('open')) {
      this.modalBackdropEl.classList.remove('open');
    }
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
      '@context': 'https://schema.org',
      '@type': 'NutritionInformation',
      name: food.name,
      servingSize: `${food.serving_size_g || 100} g`,
      calories: `${macros.calories || 0} calories`,
      proteinContent: `${macros.protein_g || 0} g`,
      carbohydrateContent: `${macros.carbs_g || 0} g`,
      fatContent: `${macros.fat_g || 0} g`,
      fiberContent: `${macros.fiber_g || 0} g`
    };

    schemaScript.textContent = JSON.stringify(schemaData, null, 2);
  }

  closeDetail() {
    if (this.detailDrawerEl) this.detailDrawerEl.classList.remove('open');
    if (this.modalBackdropEl && !this.plateDrawerEl?.classList.contains('open')) {
      this.modalBackdropEl.classList.remove('open');
    }
  }
}

window.foodRenderer = new FoodRenderer();

