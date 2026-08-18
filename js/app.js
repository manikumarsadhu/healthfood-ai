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

  // Load Food Grid
  const loadFoodGrid = async () => {
    const foods = await window.apiClient.getFoods(activeCategory, searchQuery);
    window.foodRenderer.renderGrid(foods);
  };
  await loadFoodGrid();

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
      window.foodRenderer.closeDetail();
      window.chatbotController.closeChat();
    });
  }

  // Global Keyboard Accessibility (a11y) - Dismiss modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.foodRenderer?.closeDetail();
      window.chatbotController?.closeChat();
      if (typeof window.legalController?.closeModal === 'function') {
        window.legalController.closeModal();
      }
    }
  });
});
