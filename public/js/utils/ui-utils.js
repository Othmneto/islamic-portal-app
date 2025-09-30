// UI Utilities - Enhanced Real-time UI Components

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
 * Voice visualization using Web Audio API
 */
export class VoiceVisualizer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      barCount: 20,
      barWidth: 3,
      barSpacing: 2,
      color: 'var(--brand)',
      ...options
    };
    this.analyser = null;
    this.dataArray = null;
    this.animationId = null;
    this.isActive = false;
  }

  async start(stream) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      this.analyser = audioContext.createAnalyser();
      
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      source.connect(this.analyser);
      
      this.createBars();
      this.isActive = true;
      this.animate();
      
      return audioContext;
    } catch (error) {
      console.error('Error starting voice visualizer:', error);
      this.showFallback();
    }
  }

  createBars() {
    this.container.innerHTML = '';
    this.bars = [];
    
    for (let i = 0; i < this.options.barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'waveform-bar';
      bar.style.cssText = `
        width: ${this.options.barWidth}px;
        background-color: ${this.options.color};
        border-radius: var(--radius-full);
        transition: height 0.1s ease;
        min-height: 2px;
      `;
      this.container.appendChild(bar);
      this.bars.push(bar);
    }
  }

  animate() {
    if (!this.isActive) return;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    const step = Math.floor(this.dataArray.length / this.options.barCount);
    let sum = 0;
    
    for (let i = 0; i < this.options.barCount; i++) {
      const bar = this.bars[i];
      const dataIndex = i * step;
      const value = this.dataArray[dataIndex];
      const height = Math.max(2, (value / 255) * 20);
      
      bar.style.height = `${height}px`;
      
      // Add color variation
      if (i % 2 === 0) {
        bar.style.backgroundColor = this.options.color;
      } else {
        bar.style.backgroundColor = 'var(--brand-600)';
      }
      
      sum += value;
    }
    
    // Update amplitude for mic ring
    const amplitude = Math.min(1, sum / (this.options.barCount * 255));
    this.container.style.setProperty('--amp', amplitude.toFixed(2));
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Reset bars
    if (this.bars) {
      this.bars.forEach(bar => {
        bar.style.height = '2px';
      });
    }
  }

  showFallback() {
    this.container.innerHTML = `
      <div class="waveform-fallback">
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
      </div>
    `;
  }
}

/**
 * Translation item with partial/final states
 */
export class TranslationItem {
  constructor(data, options = {}) {
    this.data = data;
    this.options = {
      showConfidence: true,
      showLatency: true,
      showStatus: true,
      ...options
    };
    this.element = this.createElement();
  }

  createElement() {
    const item = document.createElement('div');
    item.className = 'translation-item';
    item.setAttribute('aria-live', 'polite');
    
    item.innerHTML = `
      <div class="translation-header">
        <div class="lang-badge" title="${this.data.from} → ${this.data.to}">
          ${this.data.from} → ${this.data.to}
        </div>
        <div class="meta-info">
          ${this.options.showLatency ? `<span class="latency" aria-label="Latency">${this.data.latency || 0}ms</span>` : ''}
          ${this.options.showConfidence ? `<span class="confidence" aria-label="Confidence ${this.data.confidence || 0}%">
            <span class="confidence-bar">
              <span class="confidence-fill" style="width: ${this.data.confidence || 0}%"></span>
            </span>
            ${this.data.confidence || 0}%
          </span>` : ''}
        </div>
      </div>
      <div class="translation-content">
        <p class="partial-text" id="partial-${this.data.id}"></p>
        <p class="final-text" id="final-${this.data.id}" hidden></p>
      </div>
      <div class="status" id="status-${this.data.id}">
        <span class="status-dot"></span>
        <span class="status-text">Processing...</span>
      </div>
    `;
    
    return item;
  }

  updatePartial(text) {
    const partialEl = this.element.querySelector(`#partial-${this.data.id}`);
    const finalEl = this.element.querySelector(`#final-${this.data.id}`);
    const statusEl = this.element.querySelector(`#status-${this.data.id}`);
    
    if (partialEl) {
      partialEl.innerHTML = text + '<span class="cursor"></span>';
    }
    
    this.element.classList.add('partial');
    this.updateStatus('Listening...', 'listening');
  }

  updateFinal(text) {
    const partialEl = this.element.querySelector(`#partial-${this.data.id}`);
    const finalEl = this.element.querySelector(`#final-${this.data.id}`);
    const statusEl = this.element.querySelector(`#status-${this.data.id}`);
    
    if (finalEl) {
      finalEl.textContent = text;
      finalEl.hidden = false;
    }
    
    if (partialEl) {
      partialEl.hidden = true;
    }
    
    this.element.classList.remove('partial');
    this.element.classList.add('final');
    this.updateStatus('Completed', 'completed');
  }

  updateStatus(text, type) {
    const statusEl = this.element.querySelector(`#status-${this.data.id}`);
    const statusDot = statusEl?.querySelector('.status-dot');
    const statusText = statusEl?.querySelector('.status-text');
    
    if (statusText) {
      statusText.textContent = text;
    }
    
    if (statusDot) {
      statusDot.className = `status-dot ${type}`;
    }
  }

  showError(message) {
    this.element.classList.add('error');
    this.updateStatus(message, 'error');
    
    // Add retry button
    const statusEl = this.element.querySelector(`#status-${this.data.id}`);
    if (statusEl && !statusEl.querySelector('.retry-button')) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-button';
      retryBtn.textContent = 'Retry';
      retryBtn.onclick = () => {
        this.element.dispatchEvent(new CustomEvent('retry', { detail: this.data }));
      };
      statusEl.appendChild(retryBtn);
    }
  }

  getElement() {
    return this.element;
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

// Export singleton instances
export const toast = new ToastManager();
export const progress = new ProgressIndicator(document.body);
export const skeleton = new SkeletonLoader(document.body);
