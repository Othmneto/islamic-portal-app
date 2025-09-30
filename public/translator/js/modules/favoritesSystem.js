// Favorites System Module - Save and manage favorite translations
export class FavoritesSystem {
    constructor() {
        this.favorites = new Map();
        this.categories = new Map();
        this.tags = new Map();
        this.maxFavorites = 1000; // Maximum number of favorites
        
        // Load favorites from localStorage
        this.loadFavorites();
    }

    /**
     * Add translation to favorites
     * @param {Object} translation - Translation object
     * @param {string} category - Category name (optional)
     * @param {Array} tags - Tags array (optional)
     * @returns {boolean} Success status
     */
    addToFavorites(translation, category = 'general', tags = []) {
        if (this.favorites.has(translation.id)) {
            console.log('⭐ [FavoritesSystem] Translation already in favorites:', translation.id);
            return false;
        }
        
        if (this.favorites.size >= this.maxFavorites) {
            console.warn('⭐ [FavoritesSystem] Maximum favorites reached');
            return false;
        }
        
        const favoriteEntry = {
            id: translation.id,
            original: translation.original,
            translated: translation.translated,
            fromLang: translation.fromLang,
            toLang: translation.toLang,
            confidence: translation.confidence || 0,
            timestamp: Date.now(),
            addedAt: new Date().toISOString(),
            category: category,
            tags: [...tags],
            notes: '',
            isIslamic: translation.isIslamic || false,
            alternatives: translation.alternatives || [],
            culturalContext: translation.culturalContext || {},
            context: translation.context || 'general',
            usageCount: 0,
            lastUsed: Date.now()
        };
        
        this.favorites.set(translation.id, favoriteEntry);
        
        // Update categories
        this.updateCategory(category, 'add');
        
        // Update tags
        for (const tag of tags) {
            this.updateTag(tag, 'add');
        }
        
        // Save to localStorage
        this.saveFavorites();
        
        console.log('⭐ [FavoritesSystem] Added to favorites:', translation.id, category);
        return true;
    }

    /**
     * Remove translation from favorites
     * @param {string} translationId - Translation ID
     * @returns {boolean} Success status
     */
    removeFromFavorites(translationId) {
        const favorite = this.favorites.get(translationId);
        if (!favorite) {
            console.log('⭐ [FavoritesSystem] Translation not in favorites:', translationId);
            return false;
        }
        
        // Update categories
        this.updateCategory(favorite.category, 'remove');
        
        // Update tags
        for (const tag of favorite.tags) {
            this.updateTag(tag, 'remove');
        }
        
        this.favorites.delete(translationId);
        this.saveFavorites();
        
        console.log('⭐ [FavoritesSystem] Removed from favorites:', translationId);
        return true;
    }

    /**
     * Check if translation is favorited
     * @param {string} translationId - Translation ID
     * @returns {boolean} Is favorited
     */
    isFavorited(translationId) {
        return this.favorites.has(translationId);
    }

    /**
     * Get all favorites
     * @param {Object} options - Filter options
     * @returns {Array} Favorites array
     */
    getFavorites(options = {}) {
        let favorites = Array.from(this.favorites.values());
        
        // Apply filters
        if (options.category) {
            favorites = favorites.filter(fav => fav.category === options.category);
        }
        
        if (options.tags && options.tags.length > 0) {
            favorites = favorites.filter(fav => 
                options.tags.some(tag => fav.tags.includes(tag))
            );
        }
        
        if (options.languagePair) {
            favorites = favorites.filter(fav => 
                `${fav.fromLang}-${fav.toLang}` === options.languagePair
            );
        }
        
        if (options.isIslamic !== null && options.isIslamic !== undefined) {
            favorites = favorites.filter(fav => fav.isIslamic === options.isIslamic);
        }
        
        if (options.searchQuery) {
            const query = options.searchQuery.toLowerCase();
            favorites = favorites.filter(fav => 
                fav.original.toLowerCase().includes(query) ||
                fav.translated.toLowerCase().includes(query) ||
                fav.notes.toLowerCase().includes(query)
            );
        }
        
        // Sort results
        const sortBy = options.sortBy || 'addedAt';
        const sortOrder = options.sortOrder || 'desc';
        
        favorites.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'addedAt':
                    const aAddedAt = a.addedAt ? new Date(a.addedAt) : new Date(0);
                    const bAddedAt = b.addedAt ? new Date(b.addedAt) : new Date(0);
                    comparison = aAddedAt - bAddedAt;
                    break;
                case 'lastUsed':
                    const aLastUsed = a.lastUsed || 0;
                    const bLastUsed = b.lastUsed || 0;
                    comparison = aLastUsed - bLastUsed;
                    break;
                case 'usageCount':
                    const aUsageCount = a.usageCount || 0;
                    const bUsageCount = b.usageCount || 0;
                    comparison = aUsageCount - bUsageCount;
                    break;
                case 'confidence':
                    const aConfidence = a.confidence || 0;
                    const bConfidence = b.confidence || 0;
                    comparison = aConfidence - bConfidence;
                    break;
                case 'original':
                    comparison = a.original.localeCompare(b.original);
                    break;
                case 'translated':
                    comparison = a.translated.localeCompare(b.translated);
                    break;
                default:
                    comparison = 0;
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
        });
        
        return favorites;
    }

    /**
     * Get favorite by ID
     * @param {string} translationId - Translation ID
     * @returns {Object|null} Favorite entry or null
     */
    getFavorite(translationId) {
        return this.favorites.get(translationId) || null;
    }

    /**
     * Update favorite entry
     * @param {string} translationId - Translation ID
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateFavorite(translationId, updates) {
        const favorite = this.favorites.get(translationId);
        if (!favorite) {
            console.log('⭐ [FavoritesSystem] Favorite not found:', translationId);
            return false;
        }
        
        // Handle category change
        if (updates.category && updates.category !== favorite.category) {
            this.updateCategory(favorite.category, 'remove');
            this.updateCategory(updates.category, 'add');
        }
        
        // Handle tag changes
        if (updates.tags) {
            // Remove old tags
            for (const tag of favorite.tags) {
                if (!updates.tags.includes(tag)) {
                    this.updateTag(tag, 'remove');
                }
            }
            
            // Add new tags
            for (const tag of updates.tags) {
                if (!favorite.tags.includes(tag)) {
                    this.updateTag(tag, 'add');
                }
            }
        }
        
        // Update favorite entry
        Object.assign(favorite, updates);
        favorite.lastModified = new Date().toISOString();
        
        this.saveFavorites();
        
        console.log('⭐ [FavoritesSystem] Updated favorite:', translationId);
        return true;
    }

    /**
     * Add note to favorite
     * @param {string} translationId - Translation ID
     * @param {string} note - Note text
     * @returns {boolean} Success status
     */
    addNote(translationId, note) {
        return this.updateFavorite(translationId, { notes: note });
    }

    /**
     * Add tag to favorite
     * @param {string} translationId - Translation ID
     * @param {string} tag - Tag to add
     * @returns {boolean} Success status
     */
    addTag(translationId, tag) {
        const favorite = this.favorites.get(translationId);
        if (!favorite) return false;
        
        if (!favorite.tags.includes(tag)) {
            favorite.tags.push(tag);
            this.updateTag(tag, 'add');
            this.saveFavorites();
        }
        
        return true;
    }

    /**
     * Remove tag from favorite
     * @param {string} translationId - Translation ID
     * @param {string} tag - Tag to remove
     * @returns {boolean} Success status
     */
    removeTag(translationId, tag) {
        const favorite = this.favorites.get(translationId);
        if (!favorite) return false;
        
        const index = favorite.tags.indexOf(tag);
        if (index > -1) {
            favorite.tags.splice(index, 1);
            this.updateTag(tag, 'remove');
            this.saveFavorites();
        }
        
        return true;
    }

    /**
     * Move favorite to category
     * @param {string} translationId - Translation ID
     * @param {string} category - New category
     * @returns {boolean} Success status
     */
    moveToCategory(translationId, category) {
        return this.updateFavorite(translationId, { category: category });
    }

    /**
     * Get all categories
     * @returns {Array} Categories array
     */
    getCategories() {
        return Array.from(this.categories.keys()).sort();
    }

    /**
     * Get all tags
     * @returns {Array} Tags array
     */
    getTags() {
        return Array.from(this.tags.keys()).sort();
    }

    /**
     * Get favorites by category
     * @param {string} category - Category name
     * @returns {Array} Favorites in category
     */
    getFavoritesByCategory(category) {
        return this.getFavorites({ category: category });
    }

    /**
     * Get favorites by tag
     * @param {string} tag - Tag name
     * @returns {Array} Favorites with tag
     */
    getFavoritesByTag(tag) {
        return this.getFavorites({ tags: [tag] });
    }

    /**
     * Search favorites
     * @param {string} query - Search query
     * @returns {Array} Search results
     */
    searchFavorites(query) {
        return this.getFavorites({ searchQuery: query });
    }

    /**
     * Get recently used favorites
     * @param {number} limit - Number of favorites to return
     * @returns {Array} Recent favorites
     */
    getRecentFavorites(limit = 10) {
        return this.getFavorites({ 
            sortBy: 'lastUsed', 
            sortOrder: 'desc' 
        }).slice(0, limit);
    }

    /**
     * Get most used favorites
     * @param {number} limit - Number of favorites to return
     * @returns {Array} Most used favorites
     */
    getMostUsedFavorites(limit = 10) {
        return this.getFavorites({ 
            sortBy: 'usageCount', 
            sortOrder: 'desc' 
        }).slice(0, limit);
    }

    /**
     * Increment usage count
     * @param {string} translationId - Translation ID
     */
    incrementUsage(translationId) {
        const favorite = this.favorites.get(translationId);
        if (favorite) {
            favorite.usageCount++;
            favorite.lastUsed = Date.now();
            this.saveFavorites();
        }
    }

    /**
     * Get favorites statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const totalFavorites = this.favorites.size;
        const categories = this.categories.size;
        const tags = this.tags.size;
        
        let totalUsage = 0;
        let islamicCount = 0;
        let withAlternatives = 0;
        
        for (const favorite of this.favorites.values()) {
            totalUsage += favorite.usageCount;
            if (favorite.isIslamic) islamicCount++;
            if (favorite.alternatives && favorite.alternatives.length > 0) withAlternatives++;
        }
        
        return {
            totalFavorites,
            categories,
            tags,
            totalUsage,
            averageUsage: totalFavorites > 0 ? totalUsage / totalFavorites : 0,
            islamicPercentage: totalFavorites > 0 ? (islamicCount / totalFavorites) * 100 : 0,
            alternativesPercentage: totalFavorites > 0 ? (withAlternatives / totalFavorites) * 100 : 0
        };
    }

    /**
     * Update category count
     * @param {string} category - Category name
     * @param {string} action - 'add' or 'remove'
     */
    updateCategory(category, action) {
        const count = this.categories.get(category) || 0;
        
        if (action === 'add') {
            this.categories.set(category, count + 1);
        } else if (action === 'remove') {
            if (count > 1) {
                this.categories.set(category, count - 1);
            } else {
                this.categories.delete(category);
            }
        }
    }

    /**
     * Update tag count
     * @param {string} tag - Tag name
     * @param {string} action - 'add' or 'remove'
     */
    updateTag(tag, action) {
        const count = this.tags.get(tag) || 0;
        
        if (action === 'add') {
            this.tags.set(tag, count + 1);
        } else if (action === 'remove') {
            if (count > 1) {
                this.tags.set(tag, count - 1);
            } else {
                this.tags.delete(tag);
            }
        }
    }

    /**
     * Export favorites
     * @returns {Object} Exported favorites data
     */
    exportFavorites() {
        return {
            favorites: Array.from(this.favorites.entries()),
            categories: Array.from(this.categories.entries()),
            tags: Array.from(this.tags.entries()),
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Import favorites
     * @param {Object} data - Favorites data to import
     */
    importFavorites(data) {
        if (data.favorites) {
            this.favorites = new Map(data.favorites);
        }
        if (data.categories) {
            this.categories = new Map(data.categories);
        }
        if (data.tags) {
            this.tags = new Map(data.tags);
        }
        
        this.saveFavorites();
        console.log('⭐ [FavoritesSystem] Favorites imported successfully');
    }

    /**
     * Clear all favorites
     */
    clearAll() {
        this.favorites.clear();
        this.categories.clear();
        this.tags.clear();
        this.saveFavorites();
        console.log('⭐ [FavoritesSystem] All favorites cleared');
    }

    /**
     * Save favorites to localStorage
     */
    saveFavorites() {
        try {
            const favoritesData = {
                favorites: Array.from(this.favorites.entries()),
                categories: Array.from(this.categories.entries()),
                tags: Array.from(this.tags.entries()),
                lastSaved: Date.now()
            };
            
            localStorage.setItem('favoritesSystem', JSON.stringify(favoritesData));
        } catch (error) {
            console.warn('Failed to save favorites:', error);
        }
    }

    /**
     * Load favorites from localStorage
     */
    loadFavorites() {
        try {
            const saved = localStorage.getItem('favoritesSystem');
            if (saved) {
                const data = JSON.parse(saved);
                
                if (data.favorites) {
                    this.favorites = new Map(data.favorites);
                }
                if (data.categories) {
                    this.categories = new Map(data.categories);
                }
                if (data.tags) {
                    this.tags = new Map(data.tags);
                }
                
                console.log('⭐ [FavoritesSystem] Favorites loaded successfully');
            }
        } catch (error) {
            console.warn('Failed to load favorites:', error);
        }
    }
}
