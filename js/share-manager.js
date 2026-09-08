/**
 * ShareManager for HealthFood AI
 * Handles native Web Share API and multi-platform social media sharing
 * (WhatsApp, Twitter/X, Facebook, LinkedIn, Telegram, and Copy Link).
 */
class ShareManager {
  constructor() {
    this.shareModalEl = null;
    this.modalBackdropEl = null;
    this.currentPayload = null;
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.shareModalEl = document.getElementById('share-modal');
      this.modalBackdropEl = document.getElementById('modal-backdrop');
    });
  }

  /**
   * Primary entry point for sharing content
   * @param {Object} payload { title, text, url, foodName, foodSlug }
   */
  async share(payload) {
    this.currentPayload = {
      title: payload.title || 'HealthFood AI Awareness Spotlight',
      text: payload.text || 'Check out today\'s nutrition insight on HealthFood AI!',
      url: payload.url || window.location.href,
      foodName: payload.foodName || '',
      foodSlug: payload.foodSlug || ''
    };

    // Format rich share text with hashtags and app branding
    const formattedText = this.formatShareText(this.currentPayload);
    const shareUrl = this.currentPayload.url;

    // Try native Web Share API on supported devices (especially mobile)
    if (navigator.share && this.isMobileDevice()) {
      try {
        await navigator.share({
          title: this.currentPayload.title,
          text: formattedText,
          url: shareUrl
        });
        if (window.notificationManager) {
          window.notificationManager.showToast('Post shared successfully!', 'success');
        }
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to modal if not AbortError
        if (err.name !== 'AbortError') {
          console.warn('[ShareManager] Web Share failed, showing modal fallback:', err);
          this.openShareModal();
        }
        return;
      }
    }

    // Default to Social Share Modal on Desktop / unsupported browsers
    this.openShareModal();
  }

  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  formatShareText(payload) {
    let baseText = payload.text;
    if (payload.foodName) {
      baseText = `🥗 Daily Food Awareness: ${payload.foodName}\n\n"${payload.text}"`;
    }
    return `${baseText}\n\n🌱 Learn verified nutrition facts & AI food insights on HealthFood AI:\n${payload.url}\n\n#HealthFoodAI #NutritionAwareness #HealthyLiving #EatSmart`;
  }

  openShareModal(payload = null) {
    if (payload) {
      this.currentPayload = payload;
    }
    if (!this.currentPayload) return;

    if (!this.shareModalEl) {
      this.shareModalEl = document.getElementById('share-modal');
    }
    if (!this.modalBackdropEl) {
      this.modalBackdropEl = document.getElementById('modal-backdrop');
    }

    const shareTitleEl = document.getElementById('share-modal-title');
    const sharePreviewEl = document.getElementById('share-modal-preview');

    if (shareTitleEl) {
      shareTitleEl.textContent = this.currentPayload.title || 'Share Awareness Post';
    }

    if (sharePreviewEl) {
      sharePreviewEl.textContent = this.formatShareText(this.currentPayload);
    }

    if (this.shareModalEl) this.shareModalEl.classList.add('open');
    if (this.modalBackdropEl) this.modalBackdropEl.classList.add('open');
  }

  closeShareModal() {
    if (this.shareModalEl) this.shareModalEl.classList.remove('open');
    if (this.modalBackdropEl) {
      const activeDrawers = document.querySelectorAll('.chat-drawer.open, .plate-drawer.open');
      if (activeDrawers.length === 0) {
        this.modalBackdropEl.classList.remove('open');
      }
    }
  }

  /**
   * One-click direct social platform sharing handlers
   */
  shareToPlatform(platform) {
    if (!this.currentPayload) return;

    const formattedText = this.formatShareText(this.currentPayload);
    const encodedText = encodeURIComponent(formattedText);
    const encodedUrl = encodeURIComponent(this.currentPayload.url);

    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
        break;

      case 'twitter':
      case 'x':
        const tweetText = encodeURIComponent(`🥗 ${this.currentPayload.title}\n\n"${this.currentPayload.text.slice(0, 140)}..."\n\n#HealthFoodAI #NutritionAwareness`);
        shareUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`;
        break;

      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
        break;

      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;

      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;

      default:
        return;
    }

    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  }

  async copyShareLink(btnEl) {
    if (!this.currentPayload) return;
    const url = this.currentPayload.url;

    try {
      await navigator.clipboard.writeText(url);
      this.showCopyFeedback(btnEl, '✅ Link Copied!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }

  async copyShareText(btnEl) {
    if (!this.currentPayload) return;
    const formattedText = this.formatShareText(this.currentPayload);

    try {
      await navigator.clipboard.writeText(formattedText);
      this.showCopyFeedback(btnEl, '✅ Post Copied!');
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }

  showCopyFeedback(btnEl, text) {
    if (!btnEl) return;
    const originalText = btnEl.innerHTML;
    btnEl.innerHTML = text;
    if (window.notificationManager) {
      window.notificationManager.showToast(text, 'success');
    }
    setTimeout(() => {
      btnEl.innerHTML = originalText;
    }, 2000);
  }
}

window.shareManager = new ShareManager();
