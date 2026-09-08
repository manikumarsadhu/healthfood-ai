/**
 * Chatbot Controller for HealthFood AI
 * Manages interactive AI assistant drawer and Q&A flow.
 */
class ChatbotController {
  constructor() {
    this.chatDrawerEl = document.getElementById('chat-drawer');
    this.chatMessagesEl = document.getElementById('chat-messages');
    this.chatInputEl = document.getElementById('chat-input');
    this.isOpen = false;
    this.isGenerating = false;
    this.currentAbortController = null;
  }

  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat(initialPrompt = null) {
    const modalBackdropEl = document.getElementById('modal-backdrop');
    if (this.chatDrawerEl) {
      this.chatDrawerEl.classList.add('open');
      this.isOpen = true;
    }
    if (modalBackdropEl) {
      modalBackdropEl.classList.add('open');
    }
    if (initialPrompt) {
      this.sendUserQuestion(initialPrompt);
    }
  }

  closeChat() {
    const modalBackdropEl = document.getElementById('modal-backdrop');
    if (this.chatDrawerEl) {
      this.chatDrawerEl.classList.remove('open');
      this.isOpen = false;
    }
    if (modalBackdropEl) {
      modalBackdropEl.classList.remove('open');
    }
    if (this.isGenerating) {
      this.cancelGeneration();
    }
  }

  async sendUserQuestion(questionText = null) {
    // If generation is already in progress, button press acts as Stop Generation
    if (this.isGenerating) {
      this.cancelGeneration();
      return;
    }

    const text = questionText || (this.chatInputEl ? this.chatInputEl.value.trim() : '');
    if (!text) return;

    if (this.chatInputEl) this.chatInputEl.value = '';

    // Append user message
    this.appendMessage(text, 'user');

    // Set generating state and AbortController
    this.isGenerating = true;
    this.currentAbortController = new AbortController();
    this.updateSendButtonState(true);

    // Show loading bubble
    const loadingId = this.appendLoading();

    try {
      const activeFood = window.foodRenderer?.currentFood;
      const currentLang = window.languageManager?.currentLang || 'en';
      const res = await window.apiClient.askAI(text, activeFood?.slug, currentLang, 'basic', this.currentAbortController.signal);

      // If cancelled, exit cleanly
      if (this.currentAbortController?.signal.aborted || (res && res.cancelled)) {
        return;
      }

      this.removeLoading(loadingId);

      // Append AI response
      if (res && res.answer) {
        this.appendMessage(res.answer, 'ai', res.provider, text);
      } else {
        this.appendMessage("Sorry, I could not generate a response right now. Please try again.", 'ai');
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      this.removeLoading(loadingId);
      this.appendMessage("An error occurred while generating response.", 'ai');
    } finally {
      this.isGenerating = false;
      this.currentAbortController = null;
      this.removeLoading(loadingId);
      this.updateSendButtonState(false);
    }
  }

  cancelGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.isGenerating = false;
    this.removeLoading();
    this.updateSendButtonState(false);

    if (this.chatMessagesEl) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ai system-cancelled';
      bubble.style.cssText = 'font-style: italic; color: var(--text-muted); opacity: 0.85; font-size: 0.82rem; background: rgba(255,255,255,0.03); border: 1px dashed var(--border-color); margin-bottom: 0.5rem; border-radius: 8px; padding: 0.5rem 0.8rem;';
      bubble.innerHTML = '<span class="material-symbols-outlined" style="font-size: 0.95rem; vertical-align: middle; margin-right: 0.25rem; color: #ef4444;">block</span> Generation cancelled.';
      this.chatMessagesEl.appendChild(bubble);
      this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    }

    if (window.notificationManager) {
      window.notificationManager.showToast('Response generation stopped.', 'info');
    }
  }

  updateSendButtonState(isGenerating) {
    const sendBtn = document.getElementById('chat-send-btn');
    if (!sendBtn) return;
    if (isGenerating) {
      sendBtn.classList.add('chat-send-btn-stop');
      sendBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.2rem;">stop</span> Stop';
      sendBtn.title = 'Click to stop generating response';
    } else {
      sendBtn.classList.remove('chat-send-btn-stop');
      sendBtn.innerHTML = 'Send';
      sendBtn.title = 'Send message';
    }
  }

  clearChat() {
    if (!this.chatMessagesEl) return;
    this.chatMessagesEl.innerHTML = `
      <div class="chat-bubble ai">
        Hello! I'm your HealthFood AI Assistant. You can ask me questions about calories, vitamins, food pairing, or how specific foods support your health goals.
      </div>
      <div class="chat-starter-suggestions" style="margin-top: 0.8rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 0.25rem;"><span class="material-symbols-outlined" style="font-size: 0.95rem; color: var(--primary);">lightbulb</span> Try asking:</div>
        <button class="chat-starter-chip" onclick="window.chatbotController.sendUserQuestion('What are the top 5 high-protein vegetarian foods?')">
          <span class="material-symbols-outlined" style="font-size: 0.9rem; vertical-align: middle;">fitness_center</span> Top 5 High-Protein Vegetarian Foods
        </button>
        <button class="chat-starter-chip" onclick="window.chatbotController.sendUserQuestion('Which fruits are best for blood sugar management?')">
          <span class="material-symbols-outlined" style="font-size: 0.9rem; vertical-align: middle;">monitoring</span> Best Fruits for Blood Sugar Management
        </button>
        <button class="chat-starter-chip" onclick="window.chatbotController.sendUserQuestion('How much fiber should I consume daily for gut health?')">
          <span class="material-symbols-outlined" style="font-size: 0.9rem; vertical-align: middle;">eco</span> Fiber Goals for Gut Health & Digestion
        </button>
      </div>
    `;
  }

  appendMessage(text, sender, providerInfo = null, questionPrompt = '') {
    if (!this.chatMessagesEl) return;

    // Remove starter suggestions if present
    const starters = this.chatMessagesEl.querySelector('.chat-starter-suggestions');
    if (starters) starters.remove();

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    let contentHtml = sender === 'ai' ? this.parseMarkdown(text) : text.replace(/\n/g, '<br/>');

    if (sender === 'ai') {
      const encodedPrompt = encodeURIComponent(questionPrompt || text.slice(0, 100));
      const chatGptLink = `https://chatgpt.com/?q=${encodedPrompt}`;

      contentHtml += `
        <div class="chat-footer-actions">
          <div class="chat-action-icons">
            <button class="chat-icon-btn" title="Copy response" onclick="window.chatbotController.copyResponse(this)">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
            <button class="chat-icon-btn" title="Dislike response" onclick="window.chatbotController.feedbackResponse(this, false)">
              <span class="material-symbols-outlined">thumb_down</span>
            </button>
            <button class="chat-icon-btn" title="Like response" onclick="window.chatbotController.feedbackResponse(this, true)">
              <span class="material-symbols-outlined">thumb_up</span>
            </button>
            <button class="chat-icon-btn" title="Share response" onclick="window.chatbotController.shareResponse(this)">
              <span class="material-symbols-outlined">ios_share</span>
            </button>
            <button class="chat-icon-btn" title="Regenerate response" onclick="window.chatbotController.regenerateResponse(this)">
              <span class="material-symbols-outlined">refresh</span>
            </button>
            <button class="chat-icon-btn" title="More options" onclick="window.chatbotController.moreOptions(this)">
              <span class="material-symbols-outlined">more_horiz</span>
            </button>
          </div>
        </div>
      `;

      // Follow-up suggestion chips
      const followUps = this.getFollowUpQuestions(text);
      if (followUps.length > 0) {
        contentHtml += `
          <div class="chat-followup-container">
            ${followUps.map(f => `<button class="chat-followup-chip" onclick="window.chatbotController.sendUserQuestion('${f.replace(/'/g, "\\'")}')"><span class="material-symbols-outlined" style="font-size: 0.85rem; vertical-align: middle;">arrow_forward</span> ${f}</button>`).join('')}
          </div>
        `;
      }
    }

    bubble.innerHTML = contentHtml;
    this.chatMessagesEl.appendChild(bubble);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }

  copyResponse(btnEl) {
    const bubble = btnEl.closest('.chat-bubble');
    if (!bubble) return;
    const textToCopy = bubble.innerText.replace(/content_copy|thumb_down|thumb_up|ios_share|refresh|more_horiz/g, '').trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
      btnEl.style.color = '#10b981';
      setTimeout(() => btnEl.style.color = '', 2000);
      if (window.notificationManager) {
        window.notificationManager.showToast('Copied response to clipboard!', 'success');
      }
    }).catch(() => { });
  }

  feedbackResponse(btnEl, isPositive) {
    btnEl.style.color = isPositive ? '#10b981' : '#ef4444';
    if (window.notificationManager) {
      window.notificationManager.showToast(isPositive ? 'Thanks for your positive feedback!' : 'Feedback received. We will improve!', 'info');
    }
  }

  shareResponse(btnEl) {
    const bubble = btnEl.closest('.chat-bubble');
    if (!bubble) return;
    const textToShare = bubble.innerText.slice(0, 250);
    if (navigator.share) {
      navigator.share({ title: 'HealthFood AI', text: textToShare, url: window.location.href });
    } else {
      this.copyResponse(btnEl);
    }
  }

  regenerateResponse(btnEl) {
    const userBubbles = this.chatMessagesEl.querySelectorAll('.chat-bubble.user');
    if (userBubbles.length > 0) {
      const lastQuestion = userBubbles[userBubbles.length - 1].textContent.trim();
      this.sendUserQuestion(lastQuestion);
    }
  }

  moreOptions(btnEl) {
    if (window.notificationManager) {
      window.notificationManager.showToast('Options: Powered by HealthFood AI Engine', 'info');
    }
  }

  getFollowUpQuestions(text) {
    const lower = text.toLowerCase();
    if (lower.includes('banana')) {
      return ['How many bananas can I eat per day?', 'Is banana good before a workout?'];
    } else if (lower.includes('papaya')) {
      return ['What are the side effects of eating papaya?', 'How does papain enzyme aid digestion?'];
    } else if (lower.includes('avocado')) {
      return ['Are avocado fats good for heart health?', 'How to prepare avocado for breakfast?'];
    } else if (lower.includes('protein')) {
      return ['What are the best plant-based protein pairings?', 'How much protein do I need per day?'];
    } else if (lower.includes('fiber')) {
      return ['What foods have the highest dietary fiber?', 'Does fiber help with weight management?'];
    }
    return ['What are the best food pairings for this?', 'How to add this to daily meals?'];
  }

  parseMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="chat-title">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="chat-title">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="chat-title">$1</h1>');

    // Parse Markdown Tables
    const tableRegex = /((?:(?:\|[^\n]+\|\n)+))/g;
    html = html.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').filter(line => line.includes('|'));
      if (lines.length < 2) return match;

      let tableHtml = '<table class="chat-table">';
      let inBody = false;

      lines.forEach((line, idx) => {
        if (line.includes('---')) return;

        const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
        if (idx === 0) {
          tableHtml += '<thead><tr>';
          cells.forEach((c, cIdx) => {
            tableHtml += `<th class="${cIdx === 0 ? 'text-left' : 'text-right'}">${c}</th>`;
          });
          tableHtml += '</tr></thead>';
        } else {
          if (!inBody) {
            tableHtml += '<tbody>';
            inBody = true;
          }
          tableHtml += '<tr>';
          cells.forEach((c, cIdx) => {
            tableHtml += `<td class="${cIdx === 0 ? 'text-left' : 'text-right'}">${c}</td>`;
          });
          tableHtml += '</tr>';
        }
      });

      if (inBody) tableHtml += '</tbody>';
      tableHtml += '</table>';
      return tableHtml;
    });

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul class="chat-list">$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n(?![^<]*>)/g, '<br/>');

    return html;
  }

  appendLoading() {
    if (!this.chatMessagesEl) return null;
    this.removeLoading();
    const id = 'loading-' + Date.now();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai chat-loading-bubble';
    bubble.id = id;
    bubble.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 1rem;">
        <span style="display: flex; align-items: center; gap: 0.45rem;">
          <span class="material-symbols-outlined spin-icon" style="font-size: 1.1rem; color: var(--primary);">smart_toy</span>
          <em>Thinking...</em>
        </span>
        <button class="chat-stop-btn" onclick="window.chatbotController.cancelGeneration()" title="Stop generation">
          <span class="material-symbols-outlined" style="font-size: 0.9rem; vertical-align: middle;">stop_circle</span> Stop
        </button>
      </div>
    `;
    this.chatMessagesEl.appendChild(bubble);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    return id;
  }

  removeLoading(id = null) {
    if (id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    const loadingBubbles = this.chatMessagesEl?.querySelectorAll('.chat-loading-bubble');
    if (loadingBubbles) loadingBubbles.forEach(el => el.remove());
  }

  triggerQuickAction(actionType) {
    const food = window.foodRenderer?.currentFood;
    const foodName = food ? food.name : 'this food';

    let prompt = '';
    switch (actionType) {
      case 'explain_simple':
        prompt = `Can you explain the health benefits of ${foodName} in simple terms for a beginner?`;
        break;
      case 'vitamins':
        prompt = `What specific vitamins and minerals are highest in ${foodName} and what body functions do they support?`;
        break;
      case 'meal_ideas':
        prompt = `Give me 3 healthy meal preparation ideas using ${foodName}.`;
        break;
      case 'health_support':
        prompt = `How does consuming ${foodName} support heart, immunity, and digestive health?`;
        break;
      default:
        prompt = `Tell me more about ${foodName}.`;
    }

    this.openChat(prompt);
  }
}

window.chatbotController = new ChatbotController();
