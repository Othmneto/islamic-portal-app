/**
 * Virtual Scrolling Module
 * Implements virtual scrolling for large translation history lists
 */

export class VirtualScroller {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemHeight: 60,
            bufferSize: 5,
            threshold: 100,
            ...options
        };
        
        this.items = [];
        this.visibleItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        
        this.init();
    }
    
    init() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.height = '100%';
        
        // Create viewport
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.height = '100%';
        this.container.appendChild(this.viewport);
        
        // Create scrollable area
        this.scrollArea = document.createElement('div');
        this.scrollArea.style.position = 'absolute';
        this.scrollArea.style.top = '0';
        this.scrollArea.style.left = '0';
        this.scrollArea.style.right = '0';
        this.viewport.appendChild(this.scrollArea);
        
        // Create visible items container
        this.visibleContainer = document.createElement('div');
        this.visibleContainer.style.position = 'relative';
        this.scrollArea.appendChild(this.visibleContainer);
        
        this.bindEvents();
        this.updateDimensions();
    }
    
    bindEvents() {
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.updateVisibleItems();
    }
    
    handleResize() {
        this.updateDimensions();
        this.updateVisibleItems();
    }
    
    updateDimensions() {
        this.containerHeight = this.container.clientHeight;
        this.totalHeight = this.items.length * this.options.itemHeight;
        this.scrollArea.style.height = `${this.totalHeight}px`;
    }
    
    updateVisibleItems() {
        const startIndex = Math.floor(this.scrollTop / this.options.itemHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(this.containerHeight / this.options.itemHeight) + this.options.bufferSize,
            this.items.length
        );
        
        if (startIndex !== this.startIndex || endIndex !== this.endIndex) {
            this.startIndex = startIndex;
            this.endIndex = endIndex;
            this.renderVisibleItems();
        }
    }
    
    renderVisibleItems() {
        // Clear existing items
        this.visibleContainer.innerHTML = '';
        
        // Create visible items
        for (let i = this.startIndex; i < this.endIndex; i++) {
            const item = this.items[i];
            if (item) {
                const itemElement = this.createItemElement(item, i);
                this.visibleContainer.appendChild(itemElement);
            }
        }
        
        // Update container position
        this.visibleContainer.style.transform = `translateY(${this.startIndex * this.options.itemHeight}px)`;
    }
    
    createItemElement(item, index) {
        const element = document.createElement('div');
        element.className = 'virtual-item';
        element.style.height = `${this.options.itemHeight}px`;
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.right = '0';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.padding = '0 16px';
        element.style.borderBottom = '1px solid var(--border-color)';
        element.style.cursor = 'pointer';
        element.style.transition = 'background-color 0.2s ease';
        
        // Add hover effect
        element.addEventListener('mouseenter', () => {
            element.style.backgroundColor = 'var(--hover-bg)';
        });
        element.addEventListener('mouseleave', () => {
            element.style.backgroundColor = 'transparent';
        });
        
        // Render item content
        element.innerHTML = this.renderItemContent(item, index);
        
        return element;
    }
    
    renderItemContent(item, index) {
        // Override this method in subclasses
        return `
            <div class="item-content">
                <div class="item-text">${item.text || 'Item ' + (index + 1)}</div>
                <div class="item-meta">${item.meta || ''}</div>
            </div>
        `;
    }
    
    setItems(items) {
        this.items = items;
        this.updateDimensions();
        this.updateVisibleItems();
    }
    
    addItem(item) {
        this.items.push(item);
        this.updateDimensions();
        this.updateVisibleItems();
    }
    
    removeItem(index) {
        this.items.splice(index, 1);
        this.updateDimensions();
        this.updateVisibleItems();
    }
    
    scrollToItem(index) {
        const targetScrollTop = index * this.options.itemHeight;
        this.container.scrollTop = targetScrollTop;
    }
    
    scrollToTop() {
        this.container.scrollTop = 0;
    }
    
    scrollToBottom() {
        this.container.scrollTop = this.totalHeight;
    }
    
    getVisibleItems() {
        return this.items.slice(this.startIndex, this.endIndex);
    }
    
    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        this.container.innerHTML = '';
    }
}

/**
 * Translation History Virtual Scroller
 * Specialized virtual scroller for translation history
 */
export class TranslationHistoryScroller extends VirtualScroller {
    constructor(container, options = {}) {
        super(container, {
            itemHeight: 80,
            ...options
        });
    }
    
    renderItemContent(item, index) {
        const timestamp = new Date(item.timestamp).toLocaleString();
        const confidence = item.confidence ? Math.round(item.confidence * 100) : 0;
        
        return `
            <div class="translation-item">
                <div class="translation-header">
                    <div class="translation-languages">
                        <span class="from-lang">${item.from || 'auto'}</span>
                        <span class="arrow">→</span>
                        <span class="to-lang">${item.to}</span>
                    </div>
                    <div class="translation-meta">
                        <span class="confidence">${confidence}%</span>
                        <span class="timestamp">${timestamp}</span>
                    </div>
                </div>
                <div class="translation-content">
                    <div class="original-text">${item.original}</div>
                    <div class="translated-text">${item.translated}</div>
                </div>
            </div>
        `;
    }
}

/**
 * Language List Virtual Scroller
 * Specialized virtual scroller for language selection
 */
export class LanguageListScroller extends VirtualScroller {
    constructor(container, options = {}) {
        super(container, {
            itemHeight: 50,
            ...options
        });
    }
    
    renderItemContent(item, index) {
        return `
            <div class="language-item">
                <span class="language-flag">${item.flag || '🌐'}</span>
                <span class="language-name">${item.name}</span>
                <span class="language-code">${item.code}</span>
            </div>
        `;
    }
}
