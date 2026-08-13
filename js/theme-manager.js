/**
 * Theme Manager for HealthFood AI
 * Toggles Light and Dark theme with localStorage persistence.
 */
class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'healthfood_theme';
    this.currentTheme = localStorage.getItem(this.STORAGE_KEY) || 'dark';
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      toggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }
}

window.themeManager = new ThemeManager();
