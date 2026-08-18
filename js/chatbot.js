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
  }

  async sendUserQuestion(questionText = null) {
    const text = questionText || (this.chatInputEl ? this.chatInputEl.value.trim() : '');
    if (!text) return;

    if (this.chatInputEl) this.chatInputEl.value = '';

    // Append user message
    this.appendMessage(text, 'user');

    // Show loading bubble
    const loadingId = this.appendLoading();

    // Call API
    const activeFood = window.foodRenderer?.currentFood;
    const currentLang = window.languageManager?.currentLang || 'en';
    const res = await window.apiClient.askAI(text, activeFood?.slug, currentLang);

    // Remove loading bubble
    this.removeLoading(loadingId);

    // Append AI response
    if (res && res.answer) {
      this.appendMessage(res.answer, 'ai', res.provider, text);
    } else {
      this.appendMessage("Sorry, I could not generate a response right now. Please try again.", 'ai');
    }
  }

  clearChat() {
    if (!this.chatMessagesEl) return;
    this.chatMessagesEl.innerHTML = `
      <div class="chat-bubble ai">
        Hello! I'm your HealthFood AI Assistant. You can ask me questions about calories, vitamins, food pairing, or how specific foods support your health goals.
      </div>
      <div class="chat-starter-suggestions" style="margin-top: 0.8rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">💡 Try asking:</div>
        <button class="chat-starter-chip" onclick="window.chatbotController.sendUserQuestion('What are the top 5 high-protein vegetarian foods?')">
          🥑 Top 5 High-Protein Vegetarian Foods
        </button>
        <button class="chat-starter-chip" onclick="window.chatbotController.sendUserQuestion('Which fruits are best for blood sugar management?')">
          🍎 Best Fruits for Blood Sugar Management
        </button>
        <button class="chat-starter-chip" onclick="window.chatbotController.sendUserQuestion('How much fiber should I consume daily for gut health?')">
          🥗 Fiber Goals for Gut Health & Digestion
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
          <span style="font-size: 0.7rem; color: var(--text-muted);">⚡ ${providerInfo || 'HealthFood AI'}</span>
          <div style="display: flex; gap: 0.4rem;">
            <button class="chat-action-link" onclick="window.chatbotController.copyResponse(this)">📋 Copy</button>
            <a href="${chatGptLink}" target="_blank" rel="noopener noreferrer" class="chat-action-link" style="text-decoration: none;">💬 Open in ChatGPT ↗</a>
          </div>
        </div>
      `;

      // Follow-up suggestion chips
      const followUps = this.getFollowUpQuestions(text);
      if (followUps.length > 0) {
        contentHtml += `
          <div class="chat-followup-container">
            ${followUps.map(f => `<button class="chat-followup-chip" onclick="window.chatbotController.sendUserQuestion('${f.replace(/'/g, "\\'")}')">👉 ${f}</button>`).join('')}
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
    const textToCopy = bubble.innerText.replace(/⚡ Powered by.*|📋 Copy|💬 Open in ChatGPT ↗|👉.*/g, '').trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = btnEl.innerText;
      btnEl.innerText = '✅ Copied!';
      setTimeout(() => btnEl.innerText = originalText, 2000);
    }).catch(() => { });
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

    // Parse Markdown Tables
    const tableRegex = /((?:(?:\|[^\n]+\|\n)+))/g;
    html = html.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').filter(line => line.includes('|'));
      if (lines.length < 2) return match;

      let tableHtml = '<table>';
      let inBody = false;

      lines.forEach((line, idx) => {
        if (line.includes('---')) return;

        const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
        if (idx === 0) {
          tableHtml += '<thead><tr>';
          cells.forEach(c => tableHtml += `<th>${c}</th>`);
          tableHtml += '</tr></thead>';
        } else {
          if (!inBody) {
            tableHtml += '<tbody>';
            inBody = true;
          }
          tableHtml += '<tr>';
          cells.forEach(c => tableHtml += `<td>${c}</td>`);
          tableHtml += '</tr>';
        }
      });

      if (inBody) tableHtml += '</tbody>';
      tableHtml += '</table>';
      return tableHtml;
    });

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n(?![^<]*>)/g, '<br/>');

    return html;
  }

  appendLoading() {
    if (!this.chatMessagesEl) return null;
    const id = 'loading-' + Date.now();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai';
    bubble.id = id;
    bubble.innerHTML = `<em>🤖 Thinking...</em>`;
    this.chatMessagesEl.appendChild(bubble);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    return id;
  }

  removeLoading(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
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
