// UI Utilities - Text Translation Specific

// Global toast instance
let globalToastManager = null;

/**
 * Get or create global toast manager
 */
function getToastManager() {
  if (!globalToastManager) {
    globalToastManager = new ToastManager();
  }
  return globalToastManager;
}

/**
 * Convenience function for showing toasts
 */
export function toast(message, type = 'info', duration = 3500, options = {}) {
  return getToastManager().show(message, type, duration, options);
}

/**
 * Toast notification system
 */
export class ToastManager {
  constructor() {
    this.container = this.createContainer();
    this.toasts = new Map();
  }

  createContainer() {
    let container = document.getElementById('toast-region');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-region';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.className = 'toast-region';
      container.style.cssText = `
        position: fixed;
        top: var(--space-4);
        right: var(--space-4);
        z-index: var(--z-toast);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  show(message, type = 'info', duration = 3500, options = {}) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    // Add icon based on type
    const icon = this.getIcon(type);
    if (icon) {
      toast.innerHTML = `
        <span class="toast-icon" aria-hidden="true">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close notification" onclick="this.parentElement.remove()">×</button>
      `;
    } else {
      toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close notification" onclick="this.parentElement.remove()">×</button>
      `;
    }

    // Add action button if provided
    if (options.action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'toast-action';
      actionBtn.textContent = options.action.text;
      actionBtn.onclick = options.action.handler;
      toast.appendChild(actionBtn);
    }

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  remove(id) {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
        this.toasts.delete(id);
      }, { once: true });
    }
  }

  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || null;
  }

  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 4000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }
}

/**
 * Translation item component
 */
export class TranslationItem {
  constructor(data, options = {}) {
    this.data = data;
    this.options = {
      showConfidence: true,
      showTimestamp: true,
      showActions: true,
      ...options
    };
    this.element = this.createElement();
  }

  createElement() {
    const item = document.createElement('div');
    item.className = 'translation-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('data-translation-id', this.data.id);

    const timestamp = new Date(this.data.timestamp || Date.now());
    const timeString = timestamp.toLocaleTimeString();
    const dateString = timestamp.toLocaleDateString();

    item.innerHTML = `
      <div class="translation-item-header">
        <div class="lang-badge" title="${this.data.from} → ${this.data.to}">
          ${this.data.from} → ${this.data.to}
        </div>
        <div class="translation-meta">
          ${this.options.showTimestamp ? `<span class="timestamp" title="${dateString}">${timeString}</span>` : ''}
          ${this.options.showConfidence ? `<span class="confidence" title="Confidence: ${this.data.confidence || 0}%">${this.data.confidence || 0}%</span>` : ''}
        </div>
      </div>
      <div class="translation-content">
        <div class="original-text">
          <strong>Original:</strong> ${this.data.original}
        </div>
        <div class="translated-text">
          <strong>Translated:</strong> ${this.data.translated}
        </div>
      </div>
      ${this.options.showActions ? `
        <div class="translation-actions">
          <button class="btn btn-ghost btn-sm copy-btn" data-text="${this.data.translated}" aria-label="Copy translation">
            <i class="fas fa-copy" aria-hidden="true"></i> Copy
          </button>
          <button class="btn btn-ghost btn-sm favorite-btn" aria-label="Add to favorites">
            <i class="far fa-star" aria-hidden="true"></i> Favorite
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" aria-label="Delete translation">
            <i class="fas fa-trash" aria-hidden="true"></i> Delete
          </button>
        </div>
      ` : ''}
    `;

    // Add event listeners
    this.setupEventListeners(item);

    return item;
  }

  setupEventListeners(item) {
    // Copy button
    const copyBtn = item.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.copyToClipboard(this.data.translated);
      });
    }

    // Favorite button
    const favoriteBtn = item.querySelector('.favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', () => {
        this.toggleFavorite();
      });
    }

    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.delete();
      });
    }
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Translation copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  }

  toggleFavorite() {
    // Use the global textTranslator instance if available
    if (window.textTranslator) {
      window.textTranslator.toggleFavorite(this.data.id);
    } else {
      // Fallback to local state
      this.data.favorite = !this.data.favorite;
      this.updateFavoriteButton();
    }
  }

  updateFavoriteButton() {
    const favoriteBtn = this.element.querySelector('.favorite-btn');
    if (favoriteBtn) {
      const icon = favoriteBtn.querySelector('i');
      if (this.data.favorite) {
        icon.className = 'fas fa-star';
        favoriteBtn.classList.add('favorited');
        favoriteBtn.title = 'Remove from favorites';
      } else {
        icon.className = 'far fa-star';
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.title = 'Add to favorites';
      }
    }
  }

  delete() {
    if (confirm('Are you sure you want to delete this translation?')) {
      this.element.remove();
      this.emit('delete', this.data);
      toast.info('Translation deleted');
    }
  }

  getElement() {
    return this.element;
  }

  // Event system
  emit(event, data) {
    const customEvent = new CustomEvent(`translationItem:${event}`, {
      detail: { item: this, data }
    });
    document.dispatchEvent(customEvent);
  }
}

/**
 * Progress indicator for long operations
 */
export class ProgressIndicator {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showPercentage: true,
      showSpinner: true,
      ...options
    };
    this.progress = 0;
    this.isVisible = false;
  }

  show() {
    this.container.innerHTML = `
      <div class="progress-indicator">
        ${this.options.showSpinner ? '<div class="spinner"></div>' : ''}
        <div class="progress">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        ${this.options.showPercentage ? '<span class="progress-text">0%</span>' : ''}
      </div>
    `;
    this.isVisible = true;
  }

  update(progress, text = '') {
    if (!this.isVisible) return;

    this.progress = Math.max(0, Math.min(100, progress));

    const progressBar = this.container.querySelector('.progress-bar');
    const progressText = this.container.querySelector('.progress-text');

    if (progressBar) {
      progressBar.style.width = `${this.progress}%`;
    }

    if (progressText) {
      progressText.textContent = text || `${Math.round(this.progress)}%`;
    }
  }

  hide() {
    this.container.innerHTML = '';
    this.isVisible = false;
    this.progress = 0;
  }
}

/**
 * Skeleton loader for loading states
 */
export class SkeletonLoader {
  constructor(container, type = 'text') {
    this.container = container;
    this.type = type;
  }

  show() {
    const skeleton = document.createElement('div');
    skeleton.className = 'loading-skeleton';

    switch (this.type) {
      case 'text':
        skeleton.innerHTML = `
          <div class="skeleton-text short"></div>
          <div class="skeleton-text medium"></div>
          <div class="skeleton-text long"></div>
        `;
        break;
      case 'card':
        skeleton.innerHTML = `
          <div class="skeleton-text short"></div>
          <div class="skeleton-text medium"></div>
          <div class="skeleton-text short"></div>
        `;
        break;
      case 'list':
        skeleton.innerHTML = Array(3).fill(0).map(() => `
          <div class="skeleton-text medium"></div>
        `).join('');
        break;
    }

    this.container.appendChild(skeleton);
  }

  hide() {
    const skeleton = this.container.querySelector('.loading-skeleton');
    if (skeleton) {
      skeleton.remove();
    }
  }
}

/**
 * Text counter utility
 */
export class TextCounter {
  constructor(textarea, counterElement) {
    this.textarea = textarea;
    this.counterElement = counterElement;
    this.maxLength = textarea.getAttribute('maxlength') || 10000;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.textarea.addEventListener('input', () => {
      this.updateCounter();
    });

    this.textarea.addEventListener('paste', () => {
      setTimeout(() => this.updateCounter(), 10);
    });
  }

  updateCounter() {
    const length = this.textarea.value.length;
    const remaining = this.maxLength - length;

    this.counterElement.textContent = `${length} characters`;

    if (remaining < 100) {
      this.counterElement.style.color = 'var(--warn)';
    } else if (remaining < 0) {
      this.counterElement.style.color = 'var(--danger)';
    } else {
      this.counterElement.style.color = 'var(--brand)';
    }
  }
}

/**
 * Language detection utility
 */
export class LanguageDetector {
  static detectLanguage(text) {
    // Simple language detection based on character patterns
    const patterns = {
      arabic: /[\u0600-\u06FF]/,
      chinese: /[\u4e00-\u9fff]/,
      japanese: /[\u3040-\u309f\u30a0-\u30ff]/,
      korean: /[\uac00-\ud7af]/,
      cyrillic: /[\u0400-\u04ff]/,
      devanagari: /[\u0900-\u097f]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    // Default to English if no pattern matches
    return 'english';
  }

  static getLanguageCode(language) {
    const languageMap = {
      'english': 'en',
      'arabic': 'ar',
      'chinese': 'zh',
      'japanese': 'ja',
      'korean': 'ko',
      'russian': 'ru',
      'hindi': 'hi'
    };
    return languageMap[language] || 'en';
  }
}

// Export singleton instances
export const progress = new ProgressIndicator(document.body);
export const skeleton = new SkeletonLoader(document.body);
