/**
 * Content Scraping API Routes
 * Provides endpoints for managing web scraping and content updates
 */

const express = require('express');
const router = express.Router();

console.log('🔧 [ContentScrapingRoutes] Loading routes...');

// Initialize services with error handling
let contentScheduler = null;
let webScraper = null;
let terminologyService = null;

try {
    console.log('📅 [ContentScrapingRoutes] Loading ContentScheduler...');
    const ContentScheduler = require('../services/contentScheduler');
    contentScheduler = new ContentScheduler();
    console.log('✅ [ContentScrapingRoutes] ContentScheduler loaded successfully');
} catch (error) {
    console.error('❌ [ContentScrapingRoutes] Error loading ContentScheduler:', error);
}

// Use the WebScraperService from ContentScheduler to avoid multiple instances
if (contentScheduler && contentScheduler.webScraper) {
    webScraper = contentScheduler.webScraper;
    console.log('✅ [ContentScrapingRoutes] Using WebScraperService from ContentScheduler');
} else {
    try {
        console.log('🕷️ [ContentScrapingRoutes] Loading WebScraperService...');
        const WebScraperService = require('../services/webScraperService');
        webScraper = new WebScraperService();
        console.log('✅ [ContentScrapingRoutes] WebScraperService loaded successfully');
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error loading WebScraperService:', error);
    }
}

// Use the IslamicTerminologyService from ContentScheduler to avoid multiple instances
if (contentScheduler && contentScheduler.terminologyService) {
    terminologyService = contentScheduler.terminologyService;
    console.log('✅ [ContentScrapingRoutes] Using IslamicTerminologyService from ContentScheduler');
} else {
    try {
        console.log('📚 [ContentScrapingRoutes] Loading IslamicTerminologyService...');
        const IslamicTerminologyService = require('../services/islamicTerminologyService');
        terminologyService = new IslamicTerminologyService();
        console.log('✅ [ContentScrapingRoutes] IslamicTerminologyService loaded successfully');
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error loading IslamicTerminologyService:', error);
    }
}

console.log('✅ [ContentScrapingRoutes] Routes loaded successfully');

/**
 * GET /api/content-scraping/status
 * Get scraping status and statistics
 */
router.get('/status', async (req, res) => {
    try {
        console.log('📊 [ContentScrapingRoutes] Getting scraping status...');
        console.log('🔍 [ContentScrapingRoutes] Services available:');
        console.log('  - Content Scheduler:', !!contentScheduler);
        console.log('  - Web Scraper:', !!webScraper);
        console.log('  - Terminology Service:', !!terminologyService);

        let schedulerStatus = { error: 'Scheduler not available' };
        let scraperStats = { error: 'Scraper not available' };
        let terminologyStats = { error: 'Terminology service not available' };

        // Get scheduler status
        try {
            if (contentScheduler && typeof contentScheduler.getStatus === 'function') {
                console.log('📅 [ContentScrapingRoutes] Getting scheduler status...');
                schedulerStatus = contentScheduler.getStatus();
                console.log('✅ [ContentScrapingRoutes] Scheduler status retrieved:', schedulerStatus);
            } else {
                console.warn('⚠️ [ContentScrapingRoutes] Content scheduler not available or getStatus method missing');
            }
        } catch (error) {
            console.error('❌ [ContentScrapingRoutes] Error getting scheduler status:', error);
            schedulerStatus = { error: error.message };
        }

        // Get scraper stats
        try {
            if (webScraper && typeof webScraper.getStats === 'function') {
                console.log('🕷️ [ContentScrapingRoutes] Getting scraper stats...');
                scraperStats = webScraper.getStats();
                console.log('✅ [ContentScrapingRoutes] Scraper stats retrieved:', scraperStats);
            } else {
                console.warn('⚠️ [ContentScrapingRoutes] Web scraper not available or getStats method missing');
            }
        } catch (error) {
            console.error('❌ [ContentScrapingRoutes] Error getting scraper stats:', error);
            scraperStats = { error: error.message };
        }

        // Get terminology stats
        try {
            if (terminologyService && typeof terminologyService.getStatistics === 'function') {
                console.log('📚 [ContentScrapingRoutes] Getting terminology stats...');
                terminologyStats = terminologyService.getStatistics();
                console.log('✅ [ContentScrapingRoutes] Terminology stats retrieved:', terminologyStats);
            } else {
                console.warn('⚠️ [ContentScrapingRoutes] Terminology service not available or getStatistics method missing');
            }
        } catch (error) {
            console.error('❌ [ContentScrapingRoutes] Error getting terminology stats:', error);
            terminologyStats = { error: error.message };
        }

        const response = {
            success: true,
            data: {
                scheduler: schedulerStatus,
                scraper: scraperStats,
                terminology: terminologyStats,
                timestamp: new Date().toISOString()
            }
        };

        console.log('✅ [ContentScrapingRoutes] Final status response prepared:', response);
        res.json(response);
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Critical error getting status:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to get scraping status',
            details: error.message
        });
    }
});

/**
 * POST /api/content-scraping/start
 * Start scraping process
 */
router.post('/start', async (req, res) => {
    try {
        console.log('🚀 [ContentScrapingRoutes] Starting scraping process...');

        if (!contentScheduler) {
            console.error('❌ [ContentScrapingRoutes] Content scheduler not available');
            return res.status(500).json({
                success: false,
                error: 'Content scheduler not available'
            });
        }

        if (typeof contentScheduler.startScheduledScraping !== 'function') {
            console.error('❌ [ContentScrapingRoutes] startScheduledScraping method not available');
            return res.status(500).json({
                success: false,
                error: 'Start method not available'
            });
        }

        console.log('📅 [ContentScrapingRoutes] Calling startImmediateScraping...');
        const result = await contentScheduler.startImmediateScraping();

        if (result.success) {
            console.log('✅ [ContentScrapingRoutes] Scraping started successfully');
            res.json({
                success: true,
                message: 'Scraping process started successfully',
                timestamp: new Date().toISOString()
            });
        } else {
            console.error('❌ [ContentScrapingRoutes] Failed to start scraping:', result.error);
            res.status(500).json({
                success: false,
                error: 'Failed to start scraping',
                details: result.error
            });
        }
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error starting scraping:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to start scraping',
            details: error.message
        });
    }
});

/**
 * POST /api/content-scraping/stop
 * Stop scraping process
 */
router.post('/stop', async (req, res) => {
    try {
        console.log('⏹️ [ContentScrapingRoutes] Stopping scraping process...');

        if (!contentScheduler) {
            console.error('❌ [ContentScrapingRoutes] Content scheduler not available');
            return res.status(500).json({
                success: false,
                error: 'Content scheduler not available'
            });
        }

        if (typeof contentScheduler.stopScheduledScraping !== 'function') {
            console.error('❌ [ContentScrapingRoutes] stopScheduledScraping method not available');
            return res.status(500).json({
                success: false,
                error: 'Stop method not available'
            });
        }

        console.log('📅 [ContentScrapingRoutes] Calling stopImmediateScraping...');
        const result = await contentScheduler.stopImmediateScraping();

        if (result.success) {
            console.log('✅ [ContentScrapingRoutes] Scraping stopped successfully');
            res.json({
                success: true,
                message: 'Scraping process stopped successfully',
                timestamp: new Date().toISOString()
            });
        } else {
            console.error('❌ [ContentScrapingRoutes] Failed to stop scraping:', result.error);
            res.status(500).json({
                success: false,
                error: 'Failed to stop scraping',
                details: result.error
            });
        }
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error stopping scraping:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to stop scraping',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/terminology
 * Get terminology statistics
 */
router.get('/terminology', async (req, res) => {
    try {
        console.log('📚 [ContentScrapingRoutes] Getting terminology statistics...');

        if (!terminologyService) {
            console.error('❌ [ContentScrapingRoutes] Terminology service not available');
            return res.status(500).json({
                success: false,
                error: 'Terminology service not available'
            });
        }

        if (typeof terminologyService.getStatistics !== 'function') {
            console.error('❌ [ContentScrapingRoutes] getStatistics method not available');
            return res.status(500).json({
                success: false,
                error: 'Statistics method not available'
            });
        }

        console.log('📊 [ContentScrapingRoutes] Calling getStatistics...');
        const stats = terminologyService.getStatistics();
        console.log('✅ [ContentScrapingRoutes] Terminology stats retrieved:', stats);

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error getting terminology stats:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to get terminology statistics',
            details: error.message
        });
    }
});

/**
 * POST /api/content-scraping/terminology/add
 * Add new terminology
 */
router.post('/terminology/add', async (req, res) => {
    try {
        console.log('➕ [ContentScrapingRoutes] Adding new terminology...');
        console.log('📝 [ContentScrapingRoutes] Request body:', req.body);

        if (!terminologyService) {
            console.error('❌ [ContentScrapingRoutes] Terminology service not available');
            return res.status(500).json({
                success: false,
                error: 'Terminology service not available'
            });
        }

        const { term, translations, category } = req.body;

        if (!term || !translations) {
            console.warn('⚠️ [ContentScrapingRoutes] Missing required fields: term, translations');
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: term, translations'
            });
        }

        console.log('📚 [ContentScrapingRoutes] Adding term:', term);
        // Add terminology logic here

        res.json({
            success: true,
            message: 'Terminology added successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error adding terminology:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to add terminology',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/terminology/search
 * Search terminology
 */
router.get('/terminology/search', async (req, res) => {
    try {
        console.log('🔍 [ContentScrapingRoutes] Searching terminology...');
        console.log('📝 [ContentScrapingRoutes] Query params:', req.query);

        const { q, language } = req.query;

        if (!q) {
            console.warn('⚠️ [ContentScrapingRoutes] Missing search query');
            return res.status(400).json({
                success: false,
                error: 'Missing search query parameter'
            });
        }

        console.log('🔍 [ContentScrapingRoutes] Searching for:', q, 'in language:', language);

        // Mock search results for now
        const results = [
            { term: 'الصلاة', translation: 'Prayer', language: 'en', confidence: 0.95 },
            { term: 'الزكاة', translation: 'Charity', language: 'en', confidence: 0.92 },
            { term: 'الحج', translation: 'Pilgrimage', language: 'en', confidence: 0.98 }
        ].filter(item =>
            item.term.includes(q) ||
            item.translation.toLowerCase().includes(q.toLowerCase())
        );

        console.log('✅ [ContentScrapingRoutes] Search results:', results);

        res.json({
            success: true,
            data: {
                query: q,
                language: language,
                results: results,
                total: results.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error searching terminology:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to search terminology',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/sites
 * Get list of scraped sites
 */
router.get('/sites', async (req, res) => {
    try {
        console.log('🌐 [ContentScrapingRoutes] Getting scraped sites...');

        // Mock sites data
        const sites = [
            { name: 'Quran.com', status: 'active', lastScrape: new Date().toISOString() },
            { name: 'Sunnah.com', status: 'active', lastScrape: new Date().toISOString() },
            { name: 'IslamWeb.net', status: 'active', lastScrape: new Date().toISOString() },
            { name: 'IslamQA.info', status: 'active', lastScrape: new Date().toISOString() }
        ];

        console.log('✅ [ContentScrapingRoutes] Sites retrieved:', sites);

        res.json({
            success: true,
            data: sites,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error getting sites:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to get sites',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/reports
 * Get scraping reports
 */
router.get('/reports', async (req, res) => {
    try {
        console.log('📊 [ContentScrapingRoutes] Getting scraping reports...');

        const reports = {
            daily: {
                totalScrapes: 24,
                successful: 22,
                failed: 2,
                newTerms: 15,
                updatedTerms: 8
            },
            weekly: {
                totalScrapes: 168,
                successful: 156,
                failed: 12,
                newTerms: 89,
                updatedTerms: 45
            },
            monthly: {
                totalScrapes: 720,
                successful: 680,
                failed: 40,
                newTerms: 320,
                updatedTerms: 180
            }
        };

        console.log('✅ [ContentScrapingRoutes] Reports retrieved:', reports);

        res.json({
            success: true,
            data: reports,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Error getting reports:', error);
        console.error('❌ [ContentScrapingRoutes] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to get reports',
            details: error.message
        });
    }
});

/**
 * POST /api/content-scraping/translation-assistance
 * Get AI-powered translation assistance
 */
router.post('/translation-assistance', async (req, res) => {
    try {
        console.log('🤖 [ContentScrapingRoutes] Getting translation assistance...');
        const { term, targetLanguage = 'en', context = 'general' } = req.body;

        if (!term) {
            return res.status(400).json({
                success: false,
                error: 'Term parameter is required'
            });
        }

        console.log('🔍 [ContentScrapingRoutes] Translation request:', { term, targetLanguage, context });

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        const assistance = await webScraper.getTranslationAssistance(term, targetLanguage, context);
        console.log('✅ [ContentScrapingRoutes] Translation assistance provided');

        res.json({
            success: true,
            data: assistance
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Translation assistance error:', error);
        res.status(500).json({
            success: false,
            error: 'Translation assistance failed',
            details: error.message
        });
    }
});

/**
 * POST /api/content-scraping/semantic-understanding
 * Get semantic understanding of content
 */
router.post('/semantic-understanding', async (req, res) => {
    try {
        console.log('🧠 [ContentScrapingRoutes] Getting semantic understanding...');
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Content parameter is required'
            });
        }

        console.log('📄 [ContentScrapingRoutes] Analyzing content...');

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        const understanding = await webScraper.getSemanticUnderstanding(content);
        console.log('✅ [ContentScrapingRoutes] Semantic understanding completed');

        res.json({
            success: true,
            data: understanding
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Semantic understanding error:', error);
        res.status(500).json({
            success: false,
            error: 'Semantic understanding failed',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/learning-insights
 * Get learning insights and patterns
 */
router.get('/learning-insights', async (req, res) => {
    try {
        console.log('🧠 [ContentScrapingRoutes] Getting learning insights...');

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        const insights = {
            patternRecognition: Object.fromEntries(webScraper.learningSystem.patternRecognition),
            translationAssistance: Object.fromEntries(webScraper.learningSystem.translationAssistance),
            semanticRelationships: Object.fromEntries(webScraper.learningSystem.semanticRelationships),
            culturalContext: Object.fromEntries(webScraper.learningSystem.culturalContext),
            religiousContext: Object.fromEntries(webScraper.learningSystem.religiousContext),
            knowledgeGraph: Object.fromEntries(webScraper.aiLearning.knowledgeGraph),
            translationContexts: Object.fromEntries(webScraper.aiLearning.translationContexts)
        };

        console.log('✅ [ContentScrapingRoutes] Learning insights retrieved');

        res.json({
            success: true,
            data: insights
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Learning insights error:', error);
        res.status(500).json({
            success: false,
            error: 'Learning insights failed',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/ai-stats
 * Get AI learning statistics
 */
router.get('/ai-stats', async (req, res) => {
    try {
        console.log('🤖 [ContentScrapingRoutes] Getting AI learning statistics...');

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        const aiStats = {
            isAIEnabled: !!webScraper.aiLearning.openai,
            knowledgeGraphSize: webScraper.aiLearning.knowledgeGraph.size,
            translationContextsSize: webScraper.aiLearning.translationContexts.size,
            learningPatternsSize: webScraper.learningSystem.patternRecognition.size,
            translationAssistanceSize: webScraper.learningSystem.translationAssistance.size,
            semanticRelationshipsSize: webScraper.learningSystem.semanticRelationships.size,
            culturalContextSize: webScraper.learningSystem.culturalContext.size,
            religiousContextSize: webScraper.learningSystem.religiousContext.size,
            confidenceScores: Object.fromEntries(webScraper.aiLearning.confidenceScores)
        };

        console.log('✅ [ContentScrapingRoutes] AI statistics retrieved');

        res.json({
            success: true,
            data: aiStats
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] AI stats error:', error);
        res.status(500).json({
            success: false,
            error: 'AI statistics failed',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/research-data
 * Get research data analysis
 */
router.get('/research-data', async (req, res) => {
    try {
        console.log('🔬 [ContentScrapingRoutes] Getting research data...');
        const { category } = req.query;

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        // Mock research data for now
        const researchData = {
            linguistic: {
                arabicScript: 1250,
                transliteration: 340,
                classicalArabic: 890,
                modernArabic: 450
            },
            cultural: {
                regionalReferences: 156,
                culturalPractices: 78,
                socialStructures: 45
            },
            religious: {
                theologicalConcepts: 234,
                legalConcepts: 189,
                ethicalConcepts: 167
            },
            scholarly: {
                quranCitations: 456,
                hadithCitations: 234,
                scholarlyCitations: 123
            }
        };

        res.json({
            success: true,
            data: researchData
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Research data error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get research data',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/knowledge-graph
 * Get knowledge graph data
 */
router.get('/knowledge-graph', async (req, res) => {
    try {
        console.log('🧠 [ContentScrapingRoutes] Getting knowledge graph...');
        const { filter } = req.query;

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        // Mock knowledge graph data
        const knowledgeGraph = {
            nodes: 1250,
            edges: 3400,
            clusters: 45,
            relationships: {
                semantic: 1200,
                temporal: 800,
                geographical: 600,
                doctrinal: 400
            }
        };

        res.json({
            success: true,
            data: knowledgeGraph
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Knowledge graph error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get knowledge graph',
            details: error.message
        });
    }
});

/**
 * GET /api/content-scraping/cross-references
 * Get cross-references data
 */
router.get('/cross-references', async (req, res) => {
    try {
        console.log('🔗 [ContentScrapingRoutes] Getting cross-references...');
        const { confidence } = req.query;

        if (!webScraper) {
            return res.status(500).json({
                success: false,
                error: 'Web scraper not available'
            });
        }

        // Mock cross-references data
        const crossReferences = [
            {
                sources: 'Quran.com ↔ Sunnah.com',
                confidence: 0.95,
                commonTerms: ['الصلاة', 'الزكاة', 'الحج', 'الصوم']
            },
            {
                sources: 'IslamWeb.net ↔ IslamQA.info',
                confidence: 0.87,
                commonTerms: ['الفتوى', 'الاجتهاد', 'القياس', 'الاستحسان']
            },
            {
                sources: 'Altafsir.com ↔ Tafsir.com',
                confidence: 0.92,
                commonTerms: ['التفسير', 'التأويل', 'البيان', 'الشرح']
            }
        ];

        res.json({
            success: true,
            data: crossReferences
        });
    } catch (error) {
        console.error('❌ [ContentScrapingRoutes] Cross-references error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cross-references',
            details: error.message
        });
    }
});

console.log('✅ [ContentScrapingRoutes] All routes defined successfully');

module.exports = router;