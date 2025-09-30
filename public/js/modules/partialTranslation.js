/**
 * Partial Translation Module
 * Handles real-time partial translations and caching
 */

export class PartialTranslation {
    constructor() {
        this.partialCache = new Map();
        this.debounceTimeout = null;
        this.lastPartialText = '';
        this.isEnabled = true;
    }

    // Get partial translation for real-time typing
    async getPartialTranslation(text, fromLang, toLang, userId = null, sessionId = null) {
        if (!this.isEnabled || !text || text.trim().length < 2) {
            return null;
        }

        // Check local cache first
        const cacheKey = this.generateCacheKey(text, fromLang, toLang);
        const cached = this.partialCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
            return cached;
        }

        try {
            const response = await fetch('/api/translation-history/partial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    text: text.trim(),
                    fromLanguage: fromLang,
                    toLanguage: toLang,
                    sessionId: sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.data) {
                // Cache the result
                this.partialCache.set(cacheKey, {
                    ...data.data,
                    timestamp: Date.now()
                });

                return data.data;
            }

            return null;
        } catch (error) {
            console.error('Error getting partial translation:', error);
            return null;
        }
    }

    // Debounced partial translation for real-time typing
    async getDebouncedPartialTranslation(text, fromLang, toLang, userId = null, sessionId = null, delay = 300) {
        return new Promise((resolve) => {
            clearTimeout(this.debounceTimeout);
            
            this.debounceTimeout = setTimeout(async () => {
                const result = await this.getPartialTranslation(text, fromLang, toLang, userId, sessionId);
                resolve(result);
            }, delay);
        });
    }

    // Finalize partial translations
    async finalizeTranslation(conversationId, finalText, fromLang, toLang) {
        try {
            const response = await fetch('/api/translation-history/finalize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    conversationId,
                    finalText,
                    fromLanguage: fromLang,
                    toLanguage: toLang
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success ? data.data : null;
        } catch (error) {
            console.error('Error finalizing translation:', error);
            return null;
        }
    }

    // Get conversation history
    async getConversationHistory(conversationId, includePartial = true) {
        try {
            const response = await fetch(`/api/translation-history/conversation/${conversationId}?includePartial=${includePartial}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Error getting conversation history:', error);
            return [];
        }
    }

    // Search translations
    async searchTranslations(query, options = {}) {
        try {
            const params = new URLSearchParams({
                q: query,
                ...options
            });

            const response = await fetch(`/api/translation-history/search?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success ? data.data : { translations: [], pagination: {} };
        } catch (error) {
            console.error('Error searching translations:', error);
            return { translations: [], pagination: {} };
        }
    }

    // Get user statistics
    async getUserStats() {
        try {
            const response = await fetch('/api/translation-history/stats', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success ? data.data : null;
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    // Mark translation as favorite
    async markAsFavorite(translationId, isFavorite = true) {
        try {
            const response = await fetch(`/api/translation-history/${translationId}/favorite`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ isFavorite })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error updating favorite status:', error);
            return false;
        }
    }

    // Add tags to translation
    async addTags(translationId, tags) {
        try {
            const response = await fetch(`/api/translation-history/${translationId}/tags`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ tags })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error adding tags:', error);
            return false;
        }
    }

    // Delete translation
    async deleteTranslation(translationId) {
        try {
            const response = await fetch(`/api/translation-history/${translationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error deleting translation:', error);
            return false;
        }
    }

    // Export translations
    async exportTranslations(format = 'json', options = {}) {
        try {
            const response = await fetch('/api/translation-history/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({ format, ...options })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            if (format === 'csv') {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'translations.csv';
                a.click();
                URL.revokeObjectURL(url);
                return true;
            } else {
                const data = await response.json();
                return data.success ? data.data : null;
            }
        } catch (error) {
            console.error('Error exporting translations:', error);
            return null;
        }
    }

    // Generate cache key
    generateCacheKey(text, fromLang, toLang) {
        const normalizedText = text.trim().toLowerCase();
        return `${fromLang}_${toLang}_${btoa(normalizedText)}`;
    }

    // Get authentication token
    getAuthToken() {
        // Try to get token from localStorage or sessionStorage
        return localStorage.getItem('authToken') || 
               sessionStorage.getItem('authToken') || 
               this.getTokenFromCookie();
    }

    // Get token from cookie
    getTokenFromCookie() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'authToken') {
                return value;
            }
        }
        return null;
    }

    // Clear cache
    clearCache() {
        this.partialCache.clear();
    }

    // Enable/disable partial translations
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.partialCache.size,
            keys: Array.from(this.partialCache.keys())
        };
    }
}
