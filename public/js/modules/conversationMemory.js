// Conversation Memory with Vector Storage and Context Management
class ConversationMemory {
    constructor() {
        this.memories = new Map();
        this.vectorStore = new Map();
        this.contextWindow = 10; // Keep last 10 conversations
        this.maxMemorySize = 1000; // Maximum memories per session
        this.embeddingModel = 'text-embedding-ada-002';
        this.similarityThreshold = 0.7;
    }

    // Add conversation to memory
    async addConversation(conversation) {
        const memoryId = this.generateMemoryId();
        const timestamp = new Date();
        
        const memory = {
            id: memoryId,
            timestamp,
            originalText: conversation.originalText,
            translatedText: conversation.translatedText,
            fromLanguage: conversation.fromLanguage,
            toLanguage: conversation.toLanguage,
            context: conversation.context || '',
            confidence: conversation.confidence || 0,
            sessionId: conversation.sessionId,
            metadata: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };

        // Generate embedding for semantic search
        const embedding = await this.generateEmbedding(memory.originalText);
        memory.embedding = embedding;

        // Store in memory
        this.memories.set(memoryId, memory);
        this.vectorStore.set(memoryId, embedding);

        // Maintain context window
        this.maintainContextWindow();

        // Store in localStorage for persistence
        this.persistMemory(memory);

        console.log('Conversation added to memory:', memoryId);
        return memoryId;
    }

    // Generate embedding for text
    async generateEmbedding(text) {
        try {
            // Simple embedding generation (in production, use OpenAI or similar)
            const response = await fetch('/api/generate-embedding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    model: this.embeddingModel
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.embedding;
            } else {
                // Fallback to simple hash-based embedding
                return this.generateSimpleEmbedding(text);
            }
        } catch (error) {
            console.warn('Failed to generate embedding, using fallback:', error);
            return this.generateSimpleEmbedding(text);
        }
    }

    // Simple embedding fallback
    generateSimpleEmbedding(text) {
        const words = text.toLowerCase().split(/\s+/);
        const embedding = new Array(384).fill(0); // 384-dimensional embedding
        
        words.forEach(word => {
            const hash = this.simpleHash(word);
            const index = hash % 384;
            embedding[index] += 1;
        });

        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / magnitude);
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Find similar conversations
    async findSimilarConversations(query, limit = 5) {
        const queryEmbedding = await this.generateEmbedding(query);
        const similarities = [];

        for (const [memoryId, embedding] of this.vectorStore) {
            const similarity = this.cosineSimilarity(queryEmbedding, embedding);
            if (similarity >= this.similarityThreshold) {
                similarities.push({
                    memoryId,
                    similarity,
                    memory: this.memories.get(memoryId)
                });
            }
        }

        // Sort by similarity and return top results
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    // Calculate cosine similarity
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Get conversation context
    getConversationContext(sessionId, limit = 5) {
        const sessionMemories = Array.from(this.memories.values())
            .filter(memory => memory.sessionId === sessionId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);

        return sessionMemories.map(memory => ({
            original: memory.originalText,
            translated: memory.translatedText,
            from: memory.fromLanguage,
            to: memory.toLanguage,
            timestamp: memory.timestamp,
            confidence: memory.confidence
        }));
    }

    // Get relevant context for translation
    async getRelevantContext(text, sessionId) {
        const similarMemories = await this.findSimilarConversations(text, 3);
        const sessionContext = this.getConversationContext(sessionId, 3);

        return {
            similar: similarMemories,
            recent: sessionContext,
            suggestions: this.generateSuggestions(text, similarMemories)
        };
    }

    // Generate translation suggestions
    generateSuggestions(text, similarMemories) {
        const suggestions = [];

        similarMemories.forEach(memory => {
            if (memory.memory.translatedText !== text) {
                suggestions.push({
                    original: memory.memory.originalText,
                    translated: memory.memory.translatedText,
                    confidence: memory.similarity,
                    reason: 'Similar context found'
                });
            }
        });

        return suggestions.slice(0, 3);
    }

    // Maintain context window
    maintainContextWindow() {
        if (this.memories.size > this.maxMemorySize) {
            const sortedMemories = Array.from(this.memories.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toRemove = sortedMemories.slice(0, this.memories.size - this.maxMemorySize);
            toRemove.forEach(([id, memory]) => {
                this.memories.delete(id);
                this.vectorStore.delete(id);
            });
        }
    }

    // Persist memory to localStorage
    persistMemory(memory) {
        try {
            const stored = JSON.parse(localStorage.getItem('conversationMemory') || '[]');
            stored.push(memory);
            
            // Keep only last 100 memories in localStorage
            if (stored.length > 100) {
                stored.splice(0, stored.length - 100);
            }
            
            localStorage.setItem('conversationMemory', JSON.stringify(stored));
        } catch (error) {
            console.error('Failed to persist memory:', error);
        }
    }

    // Load memories from localStorage
    loadMemories() {
        try {
            const stored = JSON.parse(localStorage.getItem('conversationMemory') || '[]');
            stored.forEach(memory => {
                this.memories.set(memory.id, memory);
                if (memory.embedding) {
                    this.vectorStore.set(memory.id, memory.embedding);
                }
            });
            console.log(`Loaded ${stored.length} memories from storage`);
        } catch (error) {
            console.error('Failed to load memories:', error);
        }
    }

    // Search memories
    searchMemories(query, filters = {}) {
        let results = Array.from(this.memories.values());

        // Apply filters
        if (filters.sessionId) {
            results = results.filter(memory => memory.sessionId === filters.sessionId);
        }
        if (filters.fromLanguage) {
            results = results.filter(memory => memory.fromLanguage === filters.fromLanguage);
        }
        if (filters.toLanguage) {
            results = results.filter(memory => memory.toLanguage === filters.toLanguage);
        }
        if (filters.dateFrom) {
            results = results.filter(memory => memory.timestamp >= filters.dateFrom);
        }
        if (filters.dateTo) {
            results = results.filter(memory => memory.timestamp <= filters.dateTo);
        }

        // Text search
        if (query) {
            const queryLower = query.toLowerCase();
            results = results.filter(memory => 
                memory.originalText.toLowerCase().includes(queryLower) ||
                memory.translatedText.toLowerCase().includes(queryLower)
            );
        }

        // Sort by timestamp
        return results.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Get memory statistics
    getMemoryStats() {
        const memories = Array.from(this.memories.values());
        const languages = {};
        const sessions = new Set();

        memories.forEach(memory => {
            languages[memory.fromLanguage] = (languages[memory.fromLanguage] || 0) + 1;
            sessions.add(memory.sessionId);
        });

        return {
            totalMemories: memories.length,
            uniqueSessions: sessions.size,
            languageDistribution: languages,
            averageConfidence: memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length,
            oldestMemory: memories.length > 0 ? Math.min(...memories.map(m => m.timestamp)) : null,
            newestMemory: memories.length > 0 ? Math.max(...memories.map(m => m.timestamp)) : null
        };
    }

    // Clear memories
    clearMemories(sessionId = null) {
        if (sessionId) {
            // Clear specific session
            for (const [id, memory] of this.memories) {
                if (memory.sessionId === sessionId) {
                    this.memories.delete(id);
                    this.vectorStore.delete(id);
                }
            }
        } else {
            // Clear all memories
            this.memories.clear();
            this.vectorStore.clear();
            localStorage.removeItem('conversationMemory');
        }
        console.log('Memories cleared');
    }

    // Generate unique memory ID
    generateMemoryId() {
        return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Export memories
    exportMemories(format = 'json') {
        const memories = Array.from(this.memories.values());
        
        if (format === 'json') {
            return JSON.stringify(memories, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(memories);
        }
    }

    convertToCSV(memories) {
        const headers = ['id', 'timestamp', 'originalText', 'translatedText', 'fromLanguage', 'toLanguage', 'confidence'];
        const rows = memories.map(memory => 
            headers.map(header => `"${memory[header] || ''}"`).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    }
}

// Export for use
export default ConversationMemory;
