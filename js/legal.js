/**
 * Legal & Policy Modal Controller for HealthFood AI
 * Manages Privacy Policy, Medical Disclaimer, and Terms of Service drawers.
 */
class LegalManager {
  constructor() {
    this.modalEl = document.getElementById('legal-drawer');
    this.titleEl = document.getElementById('legal-drawer-title');
    this.bodyEl = document.getElementById('legal-drawer-body');
    this.backdropEl = document.getElementById('modal-backdrop');
  }

  openPolicy(type) {
    if (!this.modalEl || !this.titleEl || !this.bodyEl) return;

    let title = '';
    let contentHtml = '';

    switch (type) {
      case 'privacy':
        title = 'Privacy Policy';
        contentHtml = `
          <h3>Zero Personal Data Collection</h3>
          <p>HealthFood AI is built with a zero-tracking, privacy-first philosophy. We do not require account registration, login, or email capture for core application usage.</p>
          <br/>
          <h3>Client-Side Local Storage</h3>
          <p>Your preferences—including selected interface language, light/dark theme preference, notification toggles, and food favorites—are saved strictly within your device's browser local storage (<code>localStorage</code>). This data is never transmitted to our backend servers or third parties.</p>
          <br/>
          <h3>Shared AI Knowledge Cache</h3>
          <p>When you consult the AI Assistant for general nutrition explanations, responses are cached anonymously in our Cloudflare D1 database so that future visitors benefit from shared knowledge without generating redundant AI queries.</p>
        `;
        break;

      case 'disclaimer':
        title = 'Medical & Health Disclaimer';
        contentHtml = `
          <div style="background: rgba(244, 63, 94, 0.15); border-left: 4px solid #f43f5e; padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem;">
            <strong style="color: #f43f5e; font-size: 1.05rem;">⚠️ Important Health Notice</strong>
            <p style="margin-top: 0.4rem; font-size: 0.92rem; color: var(--text-primary);">HealthFood AI is strictly an educational resource. The information provided is NOT medical advice, diagnosis, or treatment.</p>
          </div>
          <h3>Educational Purpose Only</h3>
          <p>All nutritional data, calorie values, vitamin percentages, and AI explanations are provided solely for general educational and informational purposes.</p>
          <br/>
          <h3>No Doctor-Patient Relationship</h3>
          <p>Using HealthFood AI does not establish a doctor-patient or healthcare provider relationship. Always consult a qualified physician, nutritionist, or registered dietitian before making significant changes to your diet, especially if you have existing health conditions, allergies, or take medications.</p>
          <br/>
          <h3>Emergency Situations</h3>
          <p>Never disregard professional medical advice or delay seeking medical treatment because of something you have read on this application. If you have a medical emergency, contact your local emergency services immediately.</p>
        `;
        break;

      case 'terms':
        title = 'Terms of Service';
        contentHtml = `
          <h3>Acceptance of Terms</h3>
          <p>By accessing or using HealthFood AI, you agree to comply with and be bound by these Terms of Service.</p>
          <br/>
          <h3>Fair Use & Service Limits</h3>
          <p>HealthFood AI provides free, serverless nutrition information supported by public free-tier infrastructure. Automated scraping, malicious prompt injection, or denial-of-service attempts against our API endpoints are strictly prohibited.</p>
          <br/>
          <h3>Limitation of Liability</h3>
          <p>HealthFood AI and its developers assume no liability for errors, omissions, or inaccuracies in nutritional dataset values or AI-generated educational content.</p>
        `;
        break;

      default:
        title = 'Legal Information';
        contentHtml = '<p>Select a policy from the footer links.</p>';
    }

    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = contentHtml;

    this.modalEl.classList.add('open');
    if (this.backdropEl) this.backdropEl.classList.add('open');
  }

  closeModal() {
    if (this.modalEl) this.modalEl.classList.remove('open');
    if (this.backdropEl && !document.getElementById('detail-drawer')?.classList.contains('open')) {
      this.backdropEl.classList.remove('open');
    }
  }
}

window.legalManager = new LegalManager();
