/**
 * App Controller for HealthFood AI
 * Orchestrates overall application state, event listeners, and initial setup.
 */
document.addEventListener('DOMContentLoaded', async () => {
  let activeCategory = 'all';
  let searchQuery = '';
  let searchDebounceTimeout = null;

  const getCategoryIcon = (slug, icon) => {
    const map = {
      'all': 'grid_view',
      'fruits': 'nutrition',
      'vegetables': 'eco',
      'meat': 'restaurant',
      'fish-seafood': 'set_meal',
      'fish': 'set_meal',
      'eggs': 'egg',
      'grains': 'grain',
      'legumes': 'local_florist',
      'nuts-seeds': 'grass',
      'nuts': 'grass',
      'dairy': 'water_drop'
    };
    const iconName = (icon && icon.trim() && !icon.includes('🥦') && !icon.includes('🥗')) ? icon.trim() : (map[(slug || '').toLowerCase()] || 'restaurant');
    if (iconName.startsWith('<span')) return iconName;
    return `<span class="material-symbols-outlined">${iconName}</span>`;
  };

  // Initialize Categories Chips
  const categoriesWrapperEl = document.getElementById('category-chips-wrapper');
  if (categoriesWrapperEl) {
    const categories = await window.apiClient.getCategories();
    categoriesWrapperEl.innerHTML = categories.map(cat => `
      <button class="category-chip ${cat.slug === activeCategory ? 'active' : ''}" data-category="${cat.slug}">
        ${getCategoryIcon(cat.slug, cat.icon)}
        <span>${cat.name}</span>
      </button>
    `).join('');

    categoriesWrapperEl.querySelectorAll('.category-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        categoriesWrapperEl.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        activeCategory = target.getAttribute('data-category');
        loadFoodGrid();
      });
    });
  }

  // Load Daily Tip
  const loadDailyTip = async () => {
    const heroTextEl = document.getElementById('daily-tip-text');
    if (heroTextEl) {
      const currentLang = window.languageManager?.currentLang || 'en';
      const tipData = await window.apiClient.getDailyTip(currentLang);
      heroTextEl.textContent = tipData.tip || 'Loading health insight...';
    }
  };
  await loadDailyTip();

  // Search Input Listener
  const searchInputEl = document.getElementById('search-input');
  if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimeout);
      searchQuery = e.target.value.trim();
      window.currentSearchQuery = searchQuery;
      searchDebounceTimeout = setTimeout(() => {
        loadFoodGrid();
      }, 250);
    });
  }

  // Modern Top Progress Line Controller
  const topProgressBarEl = document.getElementById('top-progress-bar');
  const startLoadingProgress = () => {
    if (topProgressBarEl) {
      topProgressBarEl.classList.remove('complete');
      topProgressBarEl.classList.add('loading');
    }
  };
  const completeLoadingProgress = () => {
    if (topProgressBarEl) {
      topProgressBarEl.classList.remove('loading');
      topProgressBarEl.classList.add('complete');
      setTimeout(() => topProgressBarEl.classList.remove('complete'), 350);
    }
  };

  // Load Food Grid with Skeleton Shimmer
  const loadFoodGrid = async () => {
    startLoadingProgress();
    if (window.foodRenderer) {
      window.foodRenderer.renderSkeletonGrid(8);
    }
    const foods = await window.apiClient.getFoods(activeCategory, searchQuery);
    window.foodRenderer.renderGrid(foods);
    completeLoadingProgress();
  };
  await loadFoodGrid();

  // Dismiss App Initial Splash Screen Overlay
  const splashEl = document.getElementById('app-splash');
  if (splashEl) {
    splashEl.classList.add('hidden');
    setTimeout(() => splashEl.remove(), 500);
  }

  // Event Listeners: Theme, Notifications & Language
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => window.themeManager.toggleTheme());
  }

  const notificationToggleBtn = document.getElementById('notification-toggle-btn');
  if (notificationToggleBtn) {
    notificationToggleBtn.addEventListener('click', () => window.notificationManager.toggleNotifications());
  }

  const languageSelectEl = document.getElementById('language-select');
  if (languageSelectEl) {
    languageSelectEl.addEventListener('change', async (e) => {
      await window.languageManager.loadLanguage(e.target.value);
      await loadDailyTip();
    });
  }


  // Event Listeners: Chat & Modal
  const openChatBtn = document.getElementById('open-chat-btn');
  if (openChatBtn) {
    openChatBtn.addEventListener('click', () => window.chatbotController.openChat());
  }

  const closeChatBtn = document.getElementById('close-chat-btn');
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => window.chatbotController.closeChat());
  }

  const chatSendBtn = document.getElementById('chat-send-btn');
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', () => window.chatbotController.sendUserQuestion());
  }

  const chatInputEl = document.getElementById('chat-input');
  if (chatInputEl) {
    chatInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') window.chatbotController.sendUserQuestion();
    });
  }

  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', () => window.foodRenderer.closeDetail());
  }

  const modalBackdropEl = document.getElementById('modal-backdrop');
  if (modalBackdropEl) {
    modalBackdropEl.addEventListener('click', () => {
      window.foodRenderer?.closeDetail();
      window.foodRenderer?.closePlateModal();
      window.chatbotController?.closeChat();
    });
  }

  // Vision AI Photo Analysis Controller
  const openVisionModal = () => {
    const visionModalEl = document.getElementById('vision-modal');
    if (visionModalEl) visionModalEl.classList.add('open');
    if (modalBackdropEl) modalBackdropEl.classList.add('open');
  };

  const closeVisionModal = () => {
    const visionModalEl = document.getElementById('vision-modal');
    if (visionModalEl) visionModalEl.classList.remove('open');
    if (modalBackdropEl && !document.getElementById('detail-drawer')?.classList.contains('open')) {
      modalBackdropEl.classList.remove('open');
    }
  };

  const handleVisionImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    openVisionModal();
    const resultsEl = document.getElementById('vision-results');
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;" class="loading-spinner">📷</div>
          <h3 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.3rem;">Analyzing Meal Photo</h3>
          <p style="font-size: 0.85rem;">AI identifies food items $\rightarrow$ Verified Cloudflare D1 database calculates exact calories...</p>
        </div>
      `;
    }

    try {
      // Compress image client-side before sending
      let base64 = null;
      if (window.ingredientScannerController) {
        base64 = await window.ingredientScannerController.compressImage(file, 800, 800, 0.75);
      } else {
        const reader = new FileReader();
        base64 = await new Promise((res) => {
          reader.onload = (e) => res(e.target.result);
          reader.readAsDataURL(file);
        });
      }

      const response = await window.apiClient.analyzeFoodImage(base64);

      if (resultsEl && response && response.foods) {
        const foods = response.foods;
        const totals = response.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

        resultsEl.innerHTML = `
          <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.12)); border: 1px solid var(--border-highlight); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">ESTIMATED MEAL TOTALS (D1 VERIFIED)</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--primary); margin-top: 0.2rem;">🔥 ${totals.calories} <small style="font-size: 0.9rem; color: var(--text-muted);">kcal</small></div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; text-align: center; margin-top: 0.75rem; font-size: 0.8rem;">
              <div style="background: var(--bg-card); padding: 0.4rem; border-radius: 6px;">${totals.protein}g <br><small style="color: var(--text-muted);">Pro</small></div>
              <div style="background: var(--bg-card); padding: 0.4rem; border-radius: 6px;">${totals.carbs}g <br><small style="color: var(--text-muted);">Carb</small></div>
              <div style="background: var(--bg-card); padding: 0.4rem; border-radius: 6px;">${totals.fat}g <br><small style="color: var(--text-muted);">Fat</small></div>
              <div style="background: var(--bg-card); padding: 0.4rem; border-radius: 6px;">${totals.fiber}g <br><small style="color: var(--text-muted);">Fiber</small></div>
            </div>
          </div>

          <div class="section-label" style="margin-bottom: 0.75rem;">Identified Food Items</div>
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${foods.map((f) => `
              <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                    ${f.displayName || f.detectedName}
                    ${f.matchedFoodId ? `<span style="font-size: 0.7rem; background: rgba(16,185,129,0.15); color: var(--primary); padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.3rem;">D1 Verified</span>` : `<span style="font-size: 0.7rem; background: rgba(245,158,11,0.15); color: #f59e0b; padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.3rem;">Unmatched</span>`}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                    Portion: ~${f.estimatedGrams}g • ${f.nutrition.calories} kcal (${f.nutrition.protein}g P, ${f.nutrition.carbs}g C)
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          ${response.notes ? `<div style="margin-top: 1rem; font-size: 0.78rem; color: var(--text-muted); text-align: center;">💡 ${response.notes}</div>` : ''}
        `;
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
      if (resultsEl) {
        resultsEl.innerHTML = `<div style="color: var(--macro-fat); padding: 1.5rem; text-align: center;">⚠️ Failed to analyze image. Please try again.</div>`;
      }
    }
  };

  // Craving Swap Controller
  const openCravingModal = () => {
    const cravingModalEl = document.getElementById('craving-modal');
    if (cravingModalEl) cravingModalEl.classList.add('open');
    if (modalBackdropEl) modalBackdropEl.classList.add('open');
  };

  const closeCravingModal = () => {
    const cravingModalEl = document.getElementById('craving-modal');
    if (cravingModalEl) cravingModalEl.classList.remove('open');
    if (modalBackdropEl && !document.getElementById('detail-drawer')?.classList.contains('open')) {
      modalBackdropEl.classList.remove('open');
    }
  };

  const openCravingSwap = async (cravingName) => {
    openCravingModal();
    const cravingResultsEl = document.getElementById('craving-results');

    if (cravingResultsEl) {
      cravingResultsEl.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;" class="loading-spinner">🍿</div>
          <div>Searching lower-calorie healthy swaps for "${cravingName}"...</div>
        </div>
      `;
    }

    try {
      const response = await window.apiClient.getCravingSwaps(cravingName);
      if (cravingResultsEl && response && response.result) {
        const res = response.result;
        cravingResultsEl.innerHTML = `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">CRAVING ALTERNATIVE FOR</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;">"${res.craving || cravingName}"</div>
          </div>

          <div class="section-label" style="margin-bottom: 0.75rem;">Nutritious Healthy Swaps</div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${(res.swaps || []).map((swap) => `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <div style="font-weight: 700; font-size: 1rem; color: var(--primary);">✨ ${swap.name}</div>
                  ${swap.estimatedCaloriesSavePercent ? `<span style="background: var(--primary); color: #ffffff; font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 10px;">-${swap.estimatedCaloriesSavePercent}% Cal</span>` : ''}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${swap.reason}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (err) {
      console.error('Craving swap error:', err);
      if (cravingResultsEl) {
        cravingResultsEl.innerHTML = `<div style="color: var(--macro-fat); padding: 1.5rem; text-align: center;">⚠️ Failed to load craving swaps.</div>`;
      }
    }
  };

  // Health Goal Chips Controller
  const syncHealthChipUI = (goal) => {
    document.querySelectorAll('.health-chip[data-goal]').forEach((chip) => {
      if (chip.getAttribute('data-goal') === goal) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  };

  const setHealthGoal = (goal) => {
    if (window.healthGoalsEngine) {
      window.healthGoalsEngine.setGoal(goal);
    }
    syncHealthChipUI(goal);
    loadFoodGrid();
  };

  // Sync initial health goal state
  if (window.healthGoalsEngine) {
    syncHealthChipUI(window.healthGoalsEngine.getGoal());
  }

  window.appController = {
    setHealthGoal,
    loadFoodGrid,
    handleVisionImageSelect,
    openVisionModal,
    closeVisionModal,
    openCravingSwap,
    openCravingModal,
    closeCravingModal
  };

  // Global Keyboard Accessibility (a11y) - Dismiss modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.foodRenderer?.closeDetail();
      window.foodRenderer?.closePlateModal();
      window.ingredientScannerController?.closeModal();
      closeVisionModal();
      closeCravingModal();
      window.chatbotController?.closeChat();
      if (typeof window.legalController?.closeModal === 'function') {
        window.legalController.closeModal();
      }
    }
  });
});


