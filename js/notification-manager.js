/**
 * Notification Manager for HealthFood AI
 * Manages daily tip reminders and browser/in-app notification preferences.
 */
class NotificationManager {
  constructor() {
    this.STORAGE_KEY = 'healthfood_notifications';
    this.settings = this.loadSettings();
    this.init();
  }

  loadSettings() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved ? JSON.parse(saved) : { enabled: false, lastTipDate: null, time: '09:00' };
  }

  saveSettings() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    this.updateUI();
  }

  init() {
    this.updateUI();
    this.checkDailyNotification();
  }

  async toggleNotifications() {
    if (!this.settings.enabled) {
      // Request Permission
      if ('Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          this.settings.enabled = true;
          this.showToast('🔔 Daily Health Tip notifications enabled!');
        } else {
          this.settings.enabled = true; // Fallback to in-app toast
          this.showToast('🔔 In-app Daily Tip reminders enabled!');
        }
      } else {
        this.settings.enabled = true;
        this.showToast('🔔 Daily Tip notifications enabled!');
      }
    } else {
      this.settings.enabled = false;
      this.showToast('🔕 Daily Tip notifications disabled.');
    }
    this.saveSettings();
  }

  async checkDailyNotification() {
    if (!this.settings.enabled) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (this.settings.lastTipDate === todayStr) return; // Already shown today

    // Fetch daily tip
    const currentLang = window.languageManager?.currentLang || 'en';
    const tipData = await window.apiClient.getDailyTip(currentLang);

    if (tipData && tipData.tip) {
      this.settings.lastTipDate = todayStr;
      this.saveSettings();

      // Show Native Notification if permitted, else In-App Toast
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('HealthFood AI — Daily Tip', {
          body: tipData.tip,
          icon: '/assets/icons/icon-192.svg'
        });
      } else {
        this.showToast(`💡 Daily Tip: ${tipData.tip}`, 6000);
      }
    }
  }

  showToast(message, duration = 4000) {
    let toastEl = document.getElementById('app-notification-toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'app-notification-toast';
      toastEl.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: var(--bg-card);
        color: var(--text-primary);
        border: 1px solid var(--border-highlight);
        padding: 0.85rem 1.35rem;
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        z-index: 300;
        font-size: 0.9rem;
        font-weight: 500;
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        opacity: 0;
        max-width: calc(100vw - 2rem);
        text-align: center;
      `;
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
    toastEl.style.opacity = '1';

    setTimeout(() => {
      toastEl.style.transform = 'translateX(-50%) translateY(100px)';
      toastEl.style.opacity = '0';
    }, duration);
  }

  updateUI() {
    const btn = document.getElementById('notification-toggle-btn');
    if (btn) {
      btn.innerHTML = this.settings.enabled ? '🔔' : '🔕';
      btn.setAttribute('title', this.settings.enabled ? 'Notifications Enabled (Click to disable)' : 'Notifications Disabled (Click to enable)');
      if (this.settings.enabled) {
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = 'var(--primary)';
      } else {
        btn.style.borderColor = 'var(--border-color)';
        btn.style.color = 'var(--text-primary)';
      }
    }
  }
}

window.notificationManager = new NotificationManager();
