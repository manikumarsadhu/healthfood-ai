/**
 * Language Manager for HealthFood AI
 * Manages i18n dictionary loading and UI string updating.
 */
class LanguageManager {
  constructor() {
    this.STORAGE_KEY = 'healthfood_lang';
    this.currentLang = localStorage.getItem(this.STORAGE_KEY) || 'en';
    this.translations = {};
    this.init();
  }

  async init() {
    await this.loadLanguage(this.currentLang);
  }

  async loadLanguage(lang) {
    try {
      const res = await fetch(`/i18n/${lang}.json`);
      if (res.ok) {
        this.translations[lang] = await res.json();
      }
    } catch (e) {
      console.warn(`Failed to fetch i18n for ${lang}, falling back to defaults`, e);
    }
    this.currentLang = lang;
    localStorage.setItem(this.STORAGE_KEY, lang);
    this.updateUI();
  }

  t(key, fallback = '') {
    const dict = this.translations[this.currentLang];
    if (dict && dict[key]) return dict[key];
    return fallback || key;
  }

  updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation) {
        if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
          el.setAttribute('placeholder', translation);
        } else {
          el.textContent = translation;
        }
      }
    });

    const selector = document.getElementById('language-select');
    if (selector) selector.value = this.currentLang;
  }
}

window.languageManager = new LanguageManager();
