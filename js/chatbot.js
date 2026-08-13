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
    if (this.chatDrawerEl) {
      this.chatDrawerEl.classList.add('open');
      this.isOpen = true;
    }
    if (initialPrompt) {
      this.sendUserQuestion(initialPrompt);
    }
  }

  closeChat() {
    if (this.chatDrawerEl) {
      this.chatDrawerEl.classList.remove('open');
      this.isOpen = false;
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
      this.appendMessage(res.answer, 'ai', res.provider);
    } else {
      this.appendMessage("Sorry, I could not generate a response right now. Please try again.", 'ai');
    }
  }

  appendMessage(text, sender, providerInfo = null) {
    if (!this.chatMessagesEl) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    
    let contentHtml = text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (providerInfo) {
      contentHtml += `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.4rem;">⚡ Powered by ${providerInfo}</div>`;
    }

    bubble.innerHTML = contentHtml;
    this.chatMessagesEl.appendChild(bubble);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
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
