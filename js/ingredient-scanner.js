/**
 * IngredientScanner Controller for HealthFood AI
 * Manages packaged ingredient checking UI, image compression, and AI API calls.
 */
class IngredientScannerController {
  constructor() {
    this.modalEl = document.getElementById('ingredient-modal');
    this.backdropEl = document.getElementById('modal-backdrop');
    this.textInputEl = document.getElementById('ingredient-text-input');
    this.fileInputEl = document.getElementById('ingredient-file-input');
    this.previewImgEl = document.getElementById('ingredient-preview-img');
    this.resultsContainerEl = document.getElementById('ingredient-results');

    this.compressedImageBase64 = null;
  }

  openModal() {
    if (this.modalEl) this.modalEl.classList.add('open');
    if (this.backdropEl) this.backdropEl.classList.add('open');
  }

  closeModal() {
    if (this.modalEl) this.modalEl.classList.remove('open');
    if (this.backdropEl && !document.getElementById('detail-drawer')?.classList.contains('open')) {
      this.backdropEl.classList.remove('open');
    }
  }

  /**
   * Handle image selection and client-side canvas compression
   */
  async handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (window.notificationManager) {
        window.notificationManager.showToast('Please select a valid image file (JPEG, PNG, WebP).', 'warning');
      }
      return;
    }

    try {
      this.compressedImageBase64 = await this.compressImage(file, 800, 800, 0.75);
      if (this.previewImgEl) {
        this.previewImgEl.src = this.compressedImageBase64;
        this.previewImgEl.style.display = 'block';
      }
    } catch (err) {
      console.warn('Image compression failed:', err);
    }
  }

  clearImage() {
    this.compressedImageBase64 = null;
    if (this.previewImgEl) {
      this.previewImgEl.src = '';
      this.previewImgEl.style.display = 'none';
    }
    if (this.fileInputEl) {
      this.fileInputEl.value = '';
    }
  }

  /**
   * Client-side canvas compression to ensure payload is under 1MB
   */
  compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }

  async runAnalysis() {
    const text = this.textInputEl?.value.trim() || '';
    const image = this.compressedImageBase64;

    if (!text && !image) {
      if (window.notificationManager) {
        window.notificationManager.showToast('Please paste an ingredient list or snap/upload a food label photo.', 'warning');
      }
      return;
    }

    if (this.resultsContainerEl) {
      this.resultsContainerEl.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;" class="loading-spinner">🧪</div>
          <div>Analyzing packaged ingredients via AI safety engine...</div>
        </div>
      `;
    }

    try {
      const response = await window.apiClient.checkIngredients({ ingredients: text, image });
      if (response && response.result) {
        this.renderResults(response.result);
      } else {
        throw new Error(response?.error || 'No result returned');
      }
    } catch (err) {
      console.error('Ingredient analysis error:', err);
      if (this.resultsContainerEl) {
        this.resultsContainerEl.innerHTML = `
          <div style="text-align: center; padding: 1.5rem; color: var(--macro-fat); background: rgba(239,68,68,0.1); border-radius: 10px;">
            ⚠️ Analysis failed. Please check your internet connection or try again.
          </div>
        `;
      }
    }
  }

  renderResults(result) {
    if (!this.resultsContainerEl) return;

    const gradeColors = {
      'A': '#10b981',
      'B': '#3b82f6',
      'C': '#f59e0b',
      'D': '#f97316',
      'F': '#ef4444'
    };

    const color = gradeColors[result.grade] || '#f59e0b';

    this.resultsContainerEl.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.25rem; margin-top: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PACKAGED HEALTH GRADE</div>
            <div style="font-size: 0.95rem; color: var(--text-primary); font-weight: 600; margin-top: 0.2rem;">${result.summary}</div>
          </div>
          <div style="width: 52px; height: 52px; border-radius: 50%; background: ${color}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; box-shadow: 0 4px 12px ${color}40;">
            ${result.grade}
          </div>
        </div>

        ${result.redFlags && result.redFlags.length > 0 ? `
          <div class="section-label" style="margin-top: 1rem; color: var(--macro-fat);">⚠️ Ingredients to Consider</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
            ${result.redFlags.map(rf => `
              <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 0.6rem 0.88rem; font-size: 0.85rem;">
                <div style="font-weight: 700; color: var(--macro-fat); display: flex; justify-content: space-between;">
                  <span>🔍 ${rf.ingredient}</span>
                  <span style="font-size: 0.75rem; text-transform: uppercase; padding: 0.1rem 0.4rem; border-radius: 4px; background: rgba(239,68,68,0.2);">${rf.severity}</span>
                </div>
                <div style="color: var(--text-secondary); margin-top: 0.2rem; font-size: 0.8rem;">${rf.reason}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${result.positiveIngredients && result.positiveIngredients.length > 0 ? `
          <div class="section-label" style="margin-top: 1rem; color: var(--primary);">🟢 Nutritious Highlights</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.4rem;">
            ${result.positiveIngredients.map(pos => `
              <span style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: var(--primary); padding: 0.3rem 0.65rem; border-radius: 16px; font-size: 0.8rem; font-weight: 500;">✓ ${pos}</span>
            `).join('')}
          </div>
        ` : ''}

        ${result.recommendation ? `
          <div style="margin-top: 1rem; background: rgba(255,255,255,0.04); border-left: 3px solid var(--primary); padding: 0.65rem 0.85rem; font-size: 0.83rem; color: var(--text-secondary);">
            💡 <strong>Recommendation:</strong> ${result.recommendation}
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Make globally available
if (typeof window !== 'undefined') {
  window.IngredientScannerController = IngredientScannerController;
  window.ingredientScannerController = new IngredientScannerController();
}
