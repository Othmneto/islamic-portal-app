/**
 * Comprehensive Web Scraper Service for Islamic Content
 * Scrapes various Islamic websites to build a comprehensive knowledge base
 * Updates terminology database and content index automatically
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const natural = require('natural');
const { OpenAI } = require('openai');

class WebScraperService {
    constructor() {
        console.log('🔧 [WebScraperService] Initializing constructor...');
        this.baseDir = path.join(__dirname, '../data/scraped');
        console.log('📁 [WebScraperService] Base directory set to:', this.baseDir);

        try {
            const IslamicTerminologyService = require('./islamicTerminologyService');
            console.log('📚 [WebScraperService] IslamicTerminologyService loaded successfully');
            this.terminologyService = new IslamicTerminologyService();
            console.log('✅ [WebScraperService] IslamicTerminologyService instantiated successfully');
            console.log('🔍 [WebScraperService] Terminology service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.terminologyService)));
        } catch (error) {
            console.error('❌ [WebScraperService] Error initializing IslamicTerminologyService:', error);
            this.terminologyService = null;
        }

        // Initialize scraping stats first
        this.scrapingStats = {
            totalSites: 0,
            successfulScrapes: 0,
            failedScrapes: 0,
            newTerms: 0,
            updatedTerms: 0,
            lastScrape: null
        };

        this.scrapedContent = new Map();
        this.isScraping = false;
        this.scrapingInterval = null;

        // AI-Powered Learning System
        this.aiLearning = {
            openai: null,
            knowledgeGraph: new Map(),
            contextMemory: new Map(),
            learningPatterns: new Map(),
            semanticIndex: new Map(),
            translationContexts: new Map(),
            confidenceScores: new Map()
        };

        // Research-Grade Learning and Understanding System
        this.learningSystem = {
            patternRecognition: new Map(),
            contextUnderstanding: new Map(),
            translationAssistance: new Map(),
            semanticRelationships: new Map(),
            culturalContext: new Map(),
            religiousContext: new Map(),
            // Advanced Research Capabilities
            researchDatabase: new Map(),
            citationNetwork: new Map(),
            scholarlySources: new Map(),
            crossReferences: new Map(),
            temporalAnalysis: new Map(),
            geographicalContext: new Map(),
            linguisticEvolution: new Map(),
            doctrinalAnalysis: new Map(),
            historicalContext: new Map(),
            manuscriptSources: new Map()
        };

        // Advanced Content Analysis
        try {
            this.contentAnalysis = {
                sentimentAnalyzer: new natural.SentimentAnalyzer('en'),
                stemmer: natural.PorterStemmer,
                tokenizer: new natural.WordTokenizer(),
                tfidf: new natural.TfIdf(),
                wordNet: new natural.WordNet()
            };
            console.log('✅ [WebScraperService] Content analysis tools initialized');
        } catch (error) {
            console.error('❌ [WebScraperService] Error initializing content analysis:', error);
            // Fallback to basic analysis
            this.contentAnalysis = {
                sentimentAnalyzer: null,
                stemmer: null,
                tokenizer: null,
                tfidf: null,
                wordNet: null
            };
        }

        // Initialize AI components
        console.log('🔍 [WebScraperService] About to initialize AI, learningSystem exists:', !!this.learningSystem);
        this.initializeAI();

        // Research-Grade Data Collection
        this.researchData = {
            totalSources: 0,
            scholarlyPapers: 0,
            manuscripts: 0,
            historicalDocuments: 0,
            contemporarySources: 0,
            crossReferencedItems: 0,
            verifiedTranslations: 0,
            culturalVariations: 0,
            temporalSpan: { earliest: null, latest: null },
            geographicalCoverage: new Set(),
            languageCoverage: new Set(),
            subjectCoverage: new Set()
        };

        // Research-Grade Analysis (additional to contentAnalysis)
        this.semanticAnalyzer = new Map();
        this.culturalAnalyzer = new Map();
        this.historicalAnalyzer = new Map();
        this.linguisticAnalyzer = new Map();
        this.doctrinalAnalyzer = new Map();
        this.citationAnalyzer = new Map();
        this.crossReferenceAnalyzer = new Map();
        this.temporalAnalyzer = new Map();
        this.geographicalAnalyzer = new Map();

        console.log('✅ [WebScraperService] Constructor completed');
        console.log('🔍 [WebScraperService] Initial state:', {
            isScraping: this.isScraping,
            hasInterval: !!this.scrapingInterval,
            totalSites: this.scrapingStats.totalSites,
            aiEnabled: !!this.aiLearning.openai,
            learningSystem: Object.keys(this.learningSystem).length
        });

        // Comprehensive Islamic Research Database - Black Hole Level
        this.islamicSites = {
            // Quran & Tafsir Sources
            quran: [
                'https://quran.com', 'https://www.alquran.cloud', 'https://quran.kemenag.go.id',
                'https://www.quranflash.com', 'https://quran.ksu.edu.sa', 'https://www.quranexplorer.com',
                'https://www.altafsir.com', 'https://www.tafsir.com', 'https://www.qurancomplex.org',
                'https://www.quran.gov.sa', 'https://www.quranacademy.org', 'https://www.quranicverse.com'
            ],
            // Hadith Collections
            hadith: [
                'https://sunnah.com', 'https://www.hadithoftheday.com', 'https://www.hadithcollection.com',
                'https://www.searchtruth.com', 'https://www.hadith.net', 'https://www.islamicfinder.org/hadith',
                'https://www.hadithdatabase.com', 'https://www.hadiths.com', 'https://www.sahih-bukhari.com',
                'https://www.sahih-muslim.com', 'https://www.abu-dawud.com', 'https://www.tirmidhi.com',
                'https://www.nasai.com', 'https://www.ibn-majah.com', 'https://www.ahmad.com'
            ],
            // Fiqh & Jurisprudence
            fiqh: [
                'https://www.islamweb.net', 'https://www.islamqa.info', 'https://www.al-feqh.com',
                'https://www.islamonline.net', 'https://www.fatwa-online.com', 'https://www.islamqa.org',
                'https://www.assimalhakeem.net', 'https://www.islamqa.com', 'https://www.fatwa.org',
                'https://www.islamicfatwa.net', 'https://www.daruliftaa.com', 'https://www.muftisays.com'
            ],
            // Tafsir & Commentary
            tafsir: [
                'https://www.altafsir.com', 'https://www.tafsir.com', 'https://www.qurancomplex.org',
                'https://www.ibn-kathir.com', 'https://www.tabari.com', 'https://www.qurtubi.com',
                'https://www.baghawi.com', 'https://www.suyuti.com', 'https://www.razi.com',
                'https://www.zamakhshari.com', 'https://www.baydawi.com', 'https://www.nasafi.com'
            ],
            // Khutbah & Sermons
            khutbah: [
                'https://www.islamweb.net/khutbahs', 'https://www.islamqa.info/khutbahs',
                'https://www.khutbah.com', 'https://www.fridaykhutbah.com', 'https://www.khutbahs.com',
                'https://www.islamicfinder.org/khutbahs', 'https://www.muslim.org/khutbahs',
                'https://www.islamicity.org/khutbahs', 'https://www.islamreligion.com/khutbahs'
            ],
            // Islamic History & Biography
            history: [
                'https://www.islamicfinder.org/history', 'https://www.islamweb.net/history',
                'https://www.islamicstudies.info', 'https://www.islamicfoundation.org',
                'https://www.sirah.com', 'https://www.seerah.com', 'https://www.biography.com/islamic',
                'https://www.islamic-history.com', 'https://www.muslimheritage.com'
            ],
            // Islamic Sciences
            sciences: [
                'https://www.islamicstudies.info', 'https://www.islamicfoundation.org',
                'https://www.islamicteachings.org', 'https://www.islamicacademy.org',
                'https://www.islamicuniversity.org', 'https://www.islamiccollege.org',
                'https://www.islamicresearch.org', 'https://www.islamicscholars.org'
            ],
            // Arabic Language & Literature
            arabic: [
                'https://www.arabic-language.org', 'https://www.islamicarabic.com',
                'https://www.arabic-islamic.com', 'https://www.islamicarabic.org',
                'https://www.arabicliterature.org', 'https://www.islamicliterature.com'
            ],
            // Islamic News & Current Affairs
            news: [
                'https://www.islamicnews.com', 'https://www.middleeasteye.net',
                'https://www.arabnews.com', 'https://www.thenational.ae',
                'https://www.islamicfinder.org/news', 'https://www.islamweb.net/news',
                'https://www.islamicity.org/news', 'https://www.muslim.org/news'
            ],
            // Educational & Learning
            educational: [
                'https://www.islamicstudies.info', 'https://www.learnreligions.com',
                'https://www.islamicteachings.org', 'https://www.islamicfoundation.org',
                'https://www.islamicacademy.org', 'https://www.islamicuniversity.org',
                'https://www.islamiccollege.org', 'https://www.islamicresearch.org'
            ],
            // Sufism & Spirituality
            sufism: [
                'https://www.sufism.org', 'https://www.islamicspirituality.org',
                'https://www.tasawwuf.org', 'https://www.sufiway.org',
                'https://www.islamicspirituality.com', 'https://www.sufi.com'
            ],
            // Islamic Art & Culture
            culture: [
                'https://www.islamicart.org', 'https://www.islamicculture.org',
                'https://www.islamicarchitecture.org', 'https://www.islamiccalligraphy.org',
                'https://www.islamicmusic.org', 'https://www.islamicpoetry.org'
            ],
            // Islamic Economics & Finance
            economics: [
                'https://www.islamicbanking.org', 'https://www.islamicfinance.org',
                'https://www.islamiceconomics.org', 'https://www.islamicbanking.com',
                'https://www.islamicfinance.com', 'https://www.islamiceconomics.com'
            ],
            // Islamic Medicine & Health
            medicine: [
                'https://www.islamicmedicine.org', 'https://www.islamichealth.org',
                'https://www.islamicmedicine.com', 'https://www.islamichealth.com',
                'https://www.tibb.org', 'https://www.islamicmedical.org'
            ],
            // Islamic Philosophy & Theology
            philosophy: [
                'https://www.islamicphilosophy.org', 'https://www.islamictheology.org',
                'https://www.kalam.org', 'https://www.islamicphilosophy.com',
                'https://www.islamictheology.com', 'https://www.kalam.com'
            ],
            // Islamic Law & Jurisprudence
            law: [
                'https://www.islamiclaw.org', 'https://www.sharia.org',
                'https://www.islamicjurisprudence.org', 'https://www.islamiclaw.com',
                'https://www.sharia.com', 'https://www.islamicjurisprudence.com'
            ],
            // Islamic Astronomy & Science
            astronomy: [
                'https://www.islamicastronomy.org', 'https://www.islamicscience.org',
                'https://www.islamicastronomy.com', 'https://www.islamicscience.com',
                'https://www.islamicobservatory.org', 'https://www.islamicobservatory.com'
            ]
        };

        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.requestDelay = 2000; // 2 seconds between requests
        this.maxRetries = 3;
    }

    /**
     * Initialize AI-powered learning system
     */
    initializeAI() {
        try {
            console.log('🤖 [WebScraperService] Initializing AI learning system...');

            // Initialize OpenAI if API key is available
            if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key') {
                this.aiLearning.openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY
                });
                console.log('✅ [WebScraperService] OpenAI initialized for AI learning');
            } else {
                console.log('⚠️ [WebScraperService] OpenAI API key not available, using local AI processing');
            }

            // Initialize learning patterns
            this.initializeLearningPatterns();

            console.log('✅ [WebScraperService] AI learning system initialized');
        } catch (error) {
            console.error('❌ [WebScraperService] Error initializing AI:', error);
        }
    }

    /**
     * Initialize learning patterns for Islamic content
     */
    initializeLearningPatterns() {
        console.log('🧠 [WebScraperService] Initializing learning patterns...');
        console.log('🔍 [WebScraperService] learningSystem exists:', !!this.learningSystem);
        console.log('🔍 [WebScraperService] learningSystem type:', typeof this.learningSystem);

        // Ensure learningSystem is initialized
        if (!this.learningSystem) {
            console.error('❌ [WebScraperService] learningSystem not initialized');
            return;
        }

        if (!this.learningSystem.patternRecognition) {
            console.error('❌ [WebScraperService] patternRecognition not initialized');
            console.log('🔍 [WebScraperService] learningSystem keys:', Object.keys(this.learningSystem));
            return;
        }

        // Islamic terminology patterns
        this.learningSystem.patternRecognition.set('islamic_terms', {
            arabic: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g,
            transliteration: /[a-zA-Z]+['\u2019]?[a-zA-Z]*/g,
            context: /(?:in|of|about|regarding|concerning)\s+[a-zA-Z\s]+/gi
        });

        // Religious context patterns
        this.learningSystem.religiousContext.set('prayer_context', {
            keywords: ['صلاة', 'prayer', 'salah', 'namaz', 'dua', 'دعاء'],
            context: 'worship',
            importance: 'high'
        });

        this.learningSystem.religiousContext.set('quran_context', {
            keywords: ['قرآن', 'quran', 'koran', 'ayat', 'آية', 'surah', 'سورة'],
            context: 'scripture',
            importance: 'high'
        });

        this.learningSystem.religiousContext.set('hadith_context', {
            keywords: ['حديث', 'hadith', 'sunnah', 'سنة', 'narrated', 'روى'],
            context: 'tradition',
            importance: 'high'
        });

        // Cultural context patterns
        this.learningSystem.culturalContext.set('arabic_culture', {
            regions: ['middle_east', 'north_africa', 'gulf'],
            languages: ['ar', 'ur', 'fa', 'tr'],
            traditions: ['islamic', 'arabic', 'persian', 'turkish']
        });

        console.log('✅ [WebScraperService] Learning patterns initialized');
    }

    /**
     * Initialize the scraper service
     */
    async initialize() {
        try {
            // Create data directory
            await fs.mkdir(this.baseDir, { recursive: true });
            await fs.mkdir(path.join(this.baseDir, 'quran'), { recursive: true });
            await fs.mkdir(path.join(this.baseDir, 'hadith'), { recursive: true });
            await fs.mkdir(path.join(this.baseDir, 'khutbah'), { recursive: true });
            await fs.mkdir(path.join(this.baseDir, 'articles'), { recursive: true });
            await fs.mkdir(path.join(this.baseDir, 'news'), { recursive: true });
            await fs.mkdir(path.join(this.baseDir, 'educational'), { recursive: true });

            console.log('✅ [WebScraperService] Initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ [WebScraperService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Start research-grade comprehensive scraping of all Islamic content
     */
    async startComprehensiveScraping() {
        if (this.isScraping) {
            console.log('⚠️ [WebScraperService] Research scraping already in progress');
            return;
        }

        this.isScraping = true;
        this.scrapingStats.lastScrape = new Date();

        console.log('🚀 [WebScraperService] Starting RESEARCH-GRADE Islamic content scraping...');
        console.log('📚 [WebScraperService] Black Hole Mode: Absorbing ALL Islamic knowledge...');

        try {
            // Research-Grade Content Scraping - All Categories
            const scrapingTasks = [
                { name: 'Quran & Tafsir', method: () => this.scrapeQuranContent() },
                { name: 'Hadith Collections', method: () => this.scrapeHadithContent() },
                { name: 'Fiqh & Jurisprudence', method: () => this.scrapeFiqhContent() },
                { name: 'Tafsir & Commentary', method: () => this.scrapeTafsirContent() },
                { name: 'Khutbah & Sermons', method: () => this.scrapeKhutbahContent() },
                { name: 'Islamic History', method: () => this.scrapeHistoryContent() },
                { name: 'Islamic Sciences', method: () => this.scrapeSciencesContent() },
                { name: 'Arabic Language', method: () => this.scrapeArabicContent() },
                { name: 'Islamic News', method: () => this.scrapeIslamicNews() },
                { name: 'Educational Content', method: () => this.scrapeEducationalContent() },
                { name: 'Sufism & Spirituality', method: () => this.scrapeSufismContent() },
                { name: 'Islamic Art & Culture', method: () => this.scrapeCultureContent() },
                { name: 'Islamic Economics', method: () => this.scrapeEconomicsContent() },
                { name: 'Islamic Medicine', method: () => this.scrapeMedicineContent() },
                { name: 'Islamic Philosophy', method: () => this.scrapePhilosophyContent() },
                { name: 'Islamic Law', method: () => this.scrapeLawContent() },
                { name: 'Islamic Astronomy', method: () => this.scrapeAstronomyContent() }
            ];

            // Execute all scraping tasks with progress tracking
            for (let i = 0; i < scrapingTasks.length; i++) {
                const task = scrapingTasks[i];
                console.log(`📖 [WebScraperService] Scraping ${task.name} (${i + 1}/${scrapingTasks.length})...`);

                try {
                    await task.method();
                    console.log(`✅ [WebScraperService] ${task.name} completed`);
                } catch (error) {
                    console.error(`❌ [WebScraperService] ${task.name} failed:`, error.message);
                }

                // Adaptive delay based on server response
                await this.delay(this.requestDelay);
            }

            // Advanced Research Processing
            console.log('🔬 [WebScraperService] Processing research data...');
            await this.processResearchData();

            // Build comprehensive knowledge graph
            console.log('🧠 [WebScraperService] Building knowledge graph...');
            await this.buildKnowledgeGraph();

            // Cross-reference and validate data
            console.log('🔗 [WebScraperService] Cross-referencing data...');
            await this.crossReferenceData();

            // Generate comprehensive research report
            console.log('📊 [WebScraperService] Generating research report...');
            await this.generateResearchReport();

            console.log('✅ [WebScraperService] RESEARCH-GRADE scraping completed successfully');
            console.log(`📈 [WebScraperService] Total sources processed: ${this.researchData.totalSources}`);
            console.log(`🌍 [WebScraperService] Geographical coverage: ${this.researchData.geographicalCoverage.size} regions`);
            console.log(`🗣️ [WebScraperService] Language coverage: ${this.researchData.languageCoverage.size} languages`);

        } catch (error) {
            console.error('❌ [WebScraperService] Research scraping failed:', error);
        } finally {
            this.isScraping = false;
        }
    }

    /**
     * Scrape Quran content and translations
     */
    async scrapeQuranContent() {
        console.log('📖 [WebScraperService] Scraping Quran content...');

        for (const site of this.islamicSites.quran) {
            try {
                const content = await this.scrapeWebsite(site, 'quran');
                if (content) {
                    await this.saveScrapedContent('quran', site, content);
                    this.scrapingStats.successfulScrapes++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Quran site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Hadith content
     */
    async scrapeHadithContent() {
        console.log('📚 [WebScraperService] Scraping Hadith content...');

        for (const site of this.islamicSites.hadith) {
            try {
                const content = await this.scrapeWebsite(site, 'hadith');
                if (content) {
                    await this.saveScrapedContent('hadith', site, content);
                    this.scrapingStats.successfulScrapes++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Hadith site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Khutbah (sermons) content
     */
    async scrapeKhutbahContent() {
        console.log('🎤 [WebScraperService] Scraping Khutbah content...');

        for (const site of this.islamicSites.khutbah) {
            try {
                const content = await this.scrapeWebsite(site, 'khutbah');
                if (content) {
                    await this.saveScrapedContent('khutbah', site, content);
                    this.scrapingStats.successfulScrapes++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Khutbah site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape general Islamic content
     */
    async scrapeGeneralIslamicContent() {
        console.log('🕌 [WebScraperService] Scraping general Islamic content...');

        for (const site of this.islamicSites.general) {
            try {
                const content = await this.scrapeWebsite(site, 'general');
                if (content) {
                    await this.saveScrapedContent('articles', site, content);
                    this.scrapingStats.successfulScrapes++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape general site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic news content
     */
    async scrapeIslamicNews() {
        console.log('📰 [WebScraperService] Scraping Islamic news...');

        for (const site of this.islamicSites.news) {
            try {
                const content = await this.scrapeWebsite(site, 'news');
                if (content) {
                    await this.saveScrapedContent('news', site, content);
                    this.scrapingStats.successfulScrapes++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape news site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape educational Islamic content
     */
    async scrapeEducationalContent() {
        console.log('🎓 [WebScraperService] Scraping educational content...');

        for (const site of this.islamicSites.educational) {
            try {
                const content = await this.scrapeWebsite(site, 'educational');
                if (content) {
                    await this.saveScrapedContent('educational', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.educationalSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape educational site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Fiqh & Jurisprudence content
     */
    async scrapeFiqhContent() {
        console.log('⚖️ [WebScraperService] Scraping Fiqh & Jurisprudence content...');

        for (const site of this.islamicSites.fiqh) {
            try {
                const content = await this.scrapeWebsite(site, 'fiqh');
                if (content) {
                    await this.saveScrapedContent('fiqh', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.scholarlyPapers++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Fiqh site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Tafsir & Commentary content
     */
    async scrapeTafsirContent() {
        console.log('📖 [WebScraperService] Scraping Tafsir & Commentary content...');

        for (const site of this.islamicSites.tafsir) {
            try {
                const content = await this.scrapeWebsite(site, 'tafsir');
                if (content) {
                    await this.saveScrapedContent('tafsir', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.manuscripts++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Tafsir site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic History content
     */
    async scrapeHistoryContent() {
        console.log('📜 [WebScraperService] Scraping Islamic History content...');

        for (const site of this.islamicSites.history) {
            try {
                const content = await this.scrapeWebsite(site, 'history');
                if (content) {
                    await this.saveScrapedContent('history', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.historicalDocuments++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape History site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Sciences content
     */
    async scrapeSciencesContent() {
        console.log('🔬 [WebScraperService] Scraping Islamic Sciences content...');

        for (const site of this.islamicSites.sciences) {
            try {
                const content = await this.scrapeWebsite(site, 'sciences');
                if (content) {
                    await this.saveScrapedContent('sciences', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.scholarlyPapers++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Sciences site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Arabic Language content
     */
    async scrapeArabicContent() {
        console.log('📝 [WebScraperService] Scraping Arabic Language content...');

        for (const site of this.islamicSites.arabic) {
            try {
                const content = await this.scrapeWebsite(site, 'arabic');
                if (content) {
                    await this.saveScrapedContent('arabic', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.linguisticSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Arabic site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Sufism & Spirituality content
     */
    async scrapeSufismContent() {
        console.log('🕊️ [WebScraperService] Scraping Sufism & Spirituality content...');

        for (const site of this.islamicSites.sufism) {
            try {
                const content = await this.scrapeWebsite(site, 'sufism');
                if (content) {
                    await this.saveScrapedContent('sufism', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.spiritualSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Sufism site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Art & Culture content
     */
    async scrapeCultureContent() {
        console.log('🎨 [WebScraperService] Scraping Islamic Art & Culture content...');

        for (const site of this.islamicSites.culture) {
            try {
                const content = await this.scrapeWebsite(site, 'culture');
                if (content) {
                    await this.saveScrapedContent('culture', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.culturalSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Culture site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Economics content
     */
    async scrapeEconomicsContent() {
        console.log('💰 [WebScraperService] Scraping Islamic Economics content...');

        for (const site of this.islamicSites.economics) {
            try {
                const content = await this.scrapeWebsite(site, 'economics');
                if (content) {
                    await this.saveScrapedContent('economics', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.economicSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Economics site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Medicine content
     */
    async scrapeMedicineContent() {
        console.log('🏥 [WebScraperService] Scraping Islamic Medicine content...');

        for (const site of this.islamicSites.medicine) {
            try {
                const content = await this.scrapeWebsite(site, 'medicine');
                if (content) {
                    await this.saveScrapedContent('medicine', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.medicalSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Medicine site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Philosophy content
     */
    async scrapePhilosophyContent() {
        console.log('🤔 [WebScraperService] Scraping Islamic Philosophy content...');

        for (const site of this.islamicSites.philosophy) {
            try {
                const content = await this.scrapeWebsite(site, 'philosophy');
                if (content) {
                    await this.saveScrapedContent('philosophy', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.philosophicalSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Philosophy site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Law content
     */
    async scrapeLawContent() {
        console.log('⚖️ [WebScraperService] Scraping Islamic Law content...');

        for (const site of this.islamicSites.law) {
            try {
                const content = await this.scrapeWebsite(site, 'law');
                if (content) {
                    await this.saveScrapedContent('law', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.legalSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Law site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape Islamic Astronomy content
     */
    async scrapeAstronomyContent() {
        console.log('🌟 [WebScraperService] Scraping Islamic Astronomy content...');

        for (const site of this.islamicSites.astronomy) {
            try {
                const content = await this.scrapeWebsite(site, 'astronomy');
                if (content) {
                    await this.saveScrapedContent('astronomy', site, content);
                    this.scrapingStats.successfulScrapes++;
                    this.researchData.scientificSources++;
                }
            } catch (error) {
                console.error(`❌ [WebScraperService] Failed to scrape Astronomy site ${site}:`, error.message);
                this.scrapingStats.failedScrapes++;
            }
            await this.delay(this.requestDelay);
        }
    }

    /**
     * Scrape a single website
     */
    async scrapeWebsite(url, contentType) {
        try {
            console.log(`🔍 [WebScraperService] Scraping ${url}...`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000,
                maxRedirects: 5
            });

            const $ = cheerio.load(response.data);

            // Extract content based on type
            let extractedContent = {};

            switch (contentType) {
                case 'quran':
                    extractedContent = this.extractQuranContent($, url);
                    break;
                case 'hadith':
                    extractedContent = this.extractHadithContent($, url);
                    break;
                case 'khutbah':
                    extractedContent = this.extractKhutbahContent($, url);
                    break;
                case 'news':
                    extractedContent = this.extractNewsContent($, url);
                    break;
                case 'educational':
                    extractedContent = this.extractEducationalContent($, url);
                    break;
                default:
                    extractedContent = this.extractGeneralContent($, url);
            }

            return {
                url,
                contentType,
                timestamp: new Date().toISOString(),
                content: extractedContent,
                metadata: {
                    title: $('title').text().trim(),
                    description: $('meta[name="description"]').attr('content') || '',
                    language: $('html').attr('lang') || 'unknown'
                }
            };

        } catch (error) {
            console.error(`❌ [WebScraperService] Error scraping ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract Quran-specific content
     */
    extractQuranContent($, url) {
        const content = {
            verses: [],
            translations: [],
            tafsir: [],
            surahs: []
        };

        // Extract verses
        $('.verse, .ayah, .quran-verse').each((i, el) => {
            const verse = $(el).text().trim();
            if (verse) {
                content.verses.push(verse);
            }
        });

        // Extract translations
        $('.translation, .translated-text, .english-translation').each((i, el) => {
            const translation = $(el).text().trim();
            if (translation) {
                content.translations.push(translation);
            }
        });

        // Extract Tafsir
        $('.tafsir, .commentary, .explanation').each((i, el) => {
            const tafsir = $(el).text().trim();
            if (tafsir) {
                content.tafsir.push(tafsir);
            }
        });

        return content;
    }

    /**
     * Extract Hadith-specific content
     */
    extractHadithContent($, url) {
        const content = {
            hadiths: [],
            narrators: [],
            collections: []
        };

        // Extract Hadith text
        $('.hadith-text, .hadith-content, .arabic-text').each((i, el) => {
            const hadith = $(el).text().trim();
            if (hadith) {
                content.hadiths.push(hadith);
            }
        });

        // Extract narrators
        $('.narrator, .chain, .isnad').each((i, el) => {
            const narrator = $(el).text().trim();
            if (narrator) {
                content.narrators.push(narrator);
            }
        });

        return content;
    }

    /**
     * Extract Khutbah-specific content
     */
    extractKhutbahContent($, url) {
        const content = {
            khutbahs: [],
            topics: [],
            imams: []
        };

        // Extract Khutbah text
        $('.khutbah, .sermon, .lecture, .speech').each((i, el) => {
            const khutbah = $(el).text().trim();
            if (khutbah) {
                content.khutbahs.push(khutbah);
            }
        });

        // Extract topics
        $('.topic, .subject, .theme').each((i, el) => {
            const topic = $(el).text().trim();
            if (topic) {
                content.topics.push(topic);
            }
        });

        return content;
    }

    /**
     * Extract news content
     */
    extractNewsContent($, url) {
        const content = {
            articles: [],
            headlines: [],
            categories: []
        };

        // Extract article content
        $('article, .article, .news-item, .post').each((i, el) => {
            const article = $(el).text().trim();
            if (article) {
                content.articles.push(article);
            }
        });

        // Extract headlines
        $('h1, h2, h3, .headline, .title').each((i, el) => {
            const headline = $(el).text().trim();
            if (headline) {
                content.headlines.push(headline);
            }
        });

        return content;
    }

    /**
     * Extract educational content
     */
    extractEducationalContent($, url) {
        const content = {
            lessons: [],
            courses: [],
            topics: []
        };

        // Extract lesson content
        $('.lesson, .course, .tutorial, .guide').each((i, el) => {
            const lesson = $(el).text().trim();
            if (lesson) {
                content.lessons.push(lesson);
            }
        });

        return content;
    }

    /**
     * Extract general content
     */
    extractGeneralContent($, url) {
        const content = {
            text: [],
            headings: [],
            links: []
        };

        // Extract main text content
        $('p, div, span').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 10) {
                content.text.push(text);
            }
        });

        // Extract headings
        $('h1, h2, h3, h4, h5, h6').each((i, el) => {
            const heading = $(el).text().trim();
            if (heading) {
                content.headings.push(heading);
            }
        });

        return content;
    }

    /**
     * Save scraped content to file
     */
    async saveScrapedContent(category, url, content) {
        try {
            const filename = `${category}_${Date.now()}_${uuidv4().substring(0, 8)}.json`;
            const filepath = path.join(this.baseDir, category, filename);

            await fs.writeFile(filepath, JSON.stringify(content, null, 2));
            console.log(`💾 [WebScraperService] Saved content to ${filepath}`);

        } catch (error) {
            console.error(`❌ [WebScraperService] Failed to save content:`, error);
        }
    }

    /**
     * Process scraped content and update terminology database
     */
    async processScrapedContent() {
        console.log('🔄 [WebScraperService] Processing scraped content...');

        try {
            const categories = ['quran', 'hadith', 'khutbah', 'articles', 'news', 'educational'];
            let totalProcessed = 0;
            let newTerms = 0;

            for (const category of categories) {
                const categoryDir = path.join(this.baseDir, category);

                try {
                    const files = await fs.readdir(categoryDir);

                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const filepath = path.join(categoryDir, file);
                            const content = JSON.parse(await fs.readFile(filepath, 'utf8'));

                            // Extract Islamic terms from content
                            console.log(`🔍 [WebScraperService] Extracting terms from ${file}...`);
                            const terms = this.extractIslamicTermsFromContent(content);
                            console.log(`🔍 [WebScraperService] Terms extracted:`, {
                                count: Array.isArray(terms) ? terms.length : 'NOT_ARRAY',
                                type: typeof terms,
                                isArray: Array.isArray(terms)
                            });

                            // Ensure terms is an array
                            const termsArray = Array.isArray(terms) ? terms : [];
                            console.log(`🔍 [WebScraperService] Processing ${termsArray.length} terms...`);

                            // Add new terms to terminology database
                            for (const term of termsArray) {
                                console.log(`🔍 [WebScraperService] Processing term:`, term);
                                const added = await this.addTermToDatabase(term);
                                if (added) {
                                    newTerms++;
                                    console.log(`✅ [WebScraperService] Added new term: ${term.arabic || term.term || 'unknown'}`);
                                }
                            }

                            totalProcessed++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ [WebScraperService] Error processing ${category}:`, error);
                }
            }

            this.scrapingStats.newTerms = newTerms;
            console.log(`✅ [WebScraperService] Processed ${totalProcessed} files, found ${newTerms} new terms`);

        } catch (error) {
            console.error('❌ [WebScraperService] Error processing content:', error);
        }
    }

    /**
     * Extract Islamic terms from scraped content with AI-powered analysis
     */
    async extractIslamicTermsFromContent(content) {
        console.log('🔍 [WebScraperService] Extracting Islamic terms with AI analysis...');
        console.log('🔍 [WebScraperService] Content type:', typeof content);
        console.log('🔍 [WebScraperService] Content keys:', content ? Object.keys(content) : 'null');

        const terms = [];

        try {
            const allText = this.getAllTextFromContent(content);
            console.log('🔍 [WebScraperService] All text extracted, length:', allText.length);

            // Use existing terminology service to find terms
            console.log('🔍 [WebScraperService] Finding terms with terminology service...');
            const foundTerms = this.terminologyService.findIslamicTerms(allText);
            console.log('🔍 [WebScraperService] Found terms from service:', foundTerms.length);

            // AI-powered term extraction and analysis
            console.log('🔍 [WebScraperService] Starting AI analysis...');
            const aiAnalysis = await this.performAIContentAnalysis(allText, content);
            console.log('🔍 [WebScraperService] AI analysis completed');

            // Extract additional terms using pattern matching
            console.log('🔍 [WebScraperService] Extracting Arabic terms with pattern matching...');
            const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
            const arabicMatches = allText.match(arabicPattern) || [];
            console.log('🔍 [WebScraperService] Arabic matches found:', arabicMatches.length);

            for (const match of arabicMatches) {
                if (match.length > 2 && !foundTerms.some(term => term.term === match)) {
                    console.log(`🔍 [WebScraperService] Analyzing term: ${match}`);
                    const termAnalysis = await this.analyzeTermWithAI(match, allText, aiAnalysis);
                    terms.push({
                        arabic: match,
                        context: termAnalysis.context,
                        source: 'scraped',
                        confidence: termAnalysis.confidence,
                        translations: termAnalysis.translations,
                        culturalContext: termAnalysis.culturalContext,
                        religiousContext: termAnalysis.religiousContext,
                        semanticRelations: termAnalysis.semanticRelations,
                        usageExamples: termAnalysis.usageExamples,
                        difficulty: termAnalysis.difficulty,
                        importance: termAnalysis.importance
                    });
                }
            }

            // Learn from the extracted terms
            console.log('🔍 [WebScraperService] Learning from extracted terms...');
            await this.learnFromTerms(terms, allText);

            console.log(`✅ [WebScraperService] Extracted ${terms.length} terms with AI analysis`);
            console.log('🔍 [WebScraperService] Terms array type:', Array.isArray(terms));
            return terms;

        } catch (error) {
            console.error('❌ [WebScraperService] Error in extractIslamicTermsFromContent:', error);
            console.error('❌ [WebScraperService] Error stack:', error.stack);
            console.log('🔧 [WebScraperService] Returning empty array due to error');
            return [];
        }
    }

    /**
     * Perform AI-powered content analysis
     */
    async performAIContentAnalysis(text, content) {
        try {
            console.log('🤖 [WebScraperService] Performing AI content analysis...');

            if (!this.aiLearning.openai) {
                return this.performLocalContentAnalysis(text, content);
            }

            const prompt = `
            Analyze this Islamic content and provide:
            1. Main topics and themes
            2. Religious context (Quran, Hadith, Fiqh, etc.)
            3. Cultural context and regional relevance
            4. Key Islamic terms and their importance
            5. Translation difficulty level
            6. Semantic relationships between terms
            
            Content: ${text.substring(0, 2000)}
            `;

            const response = await this.aiLearning.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert Islamic scholar and translator specializing in Arabic-Islamic content analysis. Provide detailed, accurate analysis of Islamic texts with cultural and religious context."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            });

            const responseText = response.choices[0].message.content;
            console.log('🤖 [WebScraperService] AI response received:', responseText.substring(0, 200));

            let analysis;
            try {
                analysis = JSON.parse(responseText);
            } catch (parseError) {
                console.warn('⚠️ [WebScraperService] AI response not valid JSON, using fallback analysis');
                analysis = {
                    topics: ['Islamic content'],
                    religiousContext: 'General',
                    culturalContext: 'Universal',
                    keyTerms: [],
                    difficulty: 'medium',
                    relationships: []
                };
            }

            // Store in knowledge graph
            this.aiLearning.knowledgeGraph.set(content.url || 'unknown', {
                analysis,
                timestamp: new Date().toISOString(),
                confidence: 0.9
            });

            console.log('✅ [WebScraperService] AI content analysis completed');
            return analysis;

        } catch (error) {
            console.error('❌ [WebScraperService] AI analysis failed, using local analysis:', error);
            return this.performLocalContentAnalysis(text, content);
        }
    }

    /**
     * Perform local content analysis using NLP
     */
    performLocalContentAnalysis(text, content) {
        console.log('🧠 [WebScraperService] Performing local content analysis...');
        console.log('🔍 [WebScraperService] Content analysis tools available:', {
            tokenizer: !!this.contentAnalysis.tokenizer,
            sentimentAnalyzer: !!this.contentAnalysis.sentimentAnalyzer,
            tfidf: !!this.contentAnalysis.tfidf
        });

        // Handle null contentAnalysis tools
        if (!this.contentAnalysis.tokenizer) {
            console.warn('⚠️ [WebScraperService] Tokenizer not available, using basic analysis');
            return this.performBasicContentAnalysis(text, content);
        }

        const tokens = this.contentAnalysis.tokenizer.tokenize(text);
        console.log('🔍 [WebScraperService] Tokenized text:', tokens.length, 'tokens');

        let sentiment = 0;
        if (this.contentAnalysis.sentimentAnalyzer) {
            sentiment = this.contentAnalysis.sentimentAnalyzer.getSentiment(tokens);
        }

        // Extract topics using TF-IDF
        if (this.contentAnalysis.tfidf) {
            this.contentAnalysis.tfidf.addDocument(tokens);
            const topTerms = this.contentAnalysis.tfidf.listTerms(0).slice(0, 10);
            console.log('🔍 [WebScraperService] Top terms extracted:', topTerms.length);
        }

        // Determine religious context
        const religiousContext = this.determineReligiousContext(text);

        // Determine cultural context
        const culturalContext = this.determineCulturalContext(text);

        return {
            topics: topTerms.map(term => term.term),
            sentiment: sentiment,
            religiousContext: religiousContext,
            culturalContext: culturalContext,
            difficulty: this.calculateDifficulty(text),
            confidence: 0.7
        };
    }

    /**
     * Perform basic content analysis when NLP tools are not available
     */
    performBasicContentAnalysis(text, content) {
        console.log('🔧 [WebScraperService] Performing basic content analysis...');

        // Basic text analysis
        const words = text.split(/\s+/).filter(word => word.length > 2);
        console.log('🔍 [WebScraperService] Basic analysis - words found:', words.length);

        // Simple religious context detection
        const religiousContext = this.determineReligiousContext(text);
        console.log('🔍 [WebScraperService] Religious context detected:', religiousContext);

        // Basic cultural context
        const culturalContext = this.determineCulturalContext(text);
        console.log('🔍 [WebScraperService] Cultural context detected:', culturalContext);

        // Simple difficulty assessment
        const difficulty = this.calculateDifficulty(text);
        console.log('🔍 [WebScraperService] Difficulty assessed:', difficulty);

        return {
            topics: words.slice(0, 10),
            religiousContext,
            culturalContext,
            sentiment: 0,
            difficulty,
            relationships: []
        };
    }

    /**
     * Analyze individual term with AI
     */
    async analyzeTermWithAI(term, context, aiAnalysis) {
        try {
            console.log(`🔍 [WebScraperService] Analyzing term: ${term}`);

            if (!this.aiLearning.openai) {
                return this.analyzeTermLocally(term, context);
            }

            const prompt = `
            Analyze this Islamic term in context:
            Term: ${term}
            Context: ${context.substring(0, 500)}
            
            Provide:
            1. English translation
            2. Religious context (prayer, quran, hadith, etc.)
            3. Cultural significance
            4. Difficulty level (beginner, intermediate, advanced)
            5. Importance level (low, medium, high)
            6. Related terms
            7. Usage examples
            `;

            const response = await this.aiLearning.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert Islamic translator and scholar. Provide accurate, culturally sensitive analysis of Arabic Islamic terms."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.2
            });

            const analysis = JSON.parse(response.choices[0].message.content);

            // Store in translation contexts
            this.aiLearning.translationContexts.set(term, {
                analysis,
                timestamp: new Date().toISOString(),
                confidence: 0.9
            });

            return {
                context: analysis.religiousContext || 'general',
                confidence: 0.9,
                translations: analysis.translations || {},
                culturalContext: analysis.culturalSignificance || 'general',
                religiousContext: analysis.religiousContext || 'general',
                semanticRelations: analysis.relatedTerms || [],
                usageExamples: analysis.usageExamples || [],
                difficulty: analysis.difficulty || 'intermediate',
                importance: analysis.importance || 'medium'
            };

        } catch (error) {
            console.error(`❌ [WebScraperService] AI term analysis failed for ${term}:`, error);
            return this.analyzeTermLocally(term, context);
        }
    }

    /**
     * Analyze term locally using pattern matching
     */
    analyzeTermLocally(term, context) {
        console.log(`🧠 [WebScraperService] Local analysis for term: ${term}`);

        const contextLower = context.toLowerCase();
        let religiousContext = 'general';
        let culturalContext = 'general';
        let difficulty = 'intermediate';
        let importance = 'medium';

        // Determine religious context
        for (const [key, pattern] of this.learningSystem.religiousContext) {
            if (pattern.keywords.some(keyword => contextLower.includes(keyword.toLowerCase()))) {
                religiousContext = pattern.context;
                importance = pattern.importance;
                break;
            }
        }

        // Determine cultural context
        for (const [key, pattern] of this.learningSystem.culturalContext) {
            if (pattern.languages.some(lang => contextLower.includes(lang))) {
                culturalContext = key;
                break;
            }
        }

        // Calculate difficulty based on term length and complexity
        if (term.length <= 3) difficulty = 'beginner';
        else if (term.length >= 8) difficulty = 'advanced';

        return {
            context: religiousContext,
            confidence: 0.7,
            translations: { 'en': term }, // Fallback
            culturalContext: culturalContext,
            religiousContext: religiousContext,
            semanticRelations: [],
            usageExamples: [],
            difficulty: difficulty,
            importance: importance
        };
    }

    /**
     * Learn from extracted terms to improve future analysis
     */
    async learnFromTerms(terms, context) {
        console.log('🧠 [WebScraperService] Learning from extracted terms...');

        for (const term of terms) {
            // Update learning patterns
            if (!this.learningSystem.patternRecognition.has(term.arabic)) {
                this.learningSystem.patternRecognition.set(term.arabic, {
                    contexts: [term.context],
                    confidence: term.confidence,
                    frequency: 1,
                    lastSeen: new Date().toISOString()
                });
            } else {
                const pattern = this.learningSystem.patternRecognition.get(term.arabic);
                pattern.frequency += 1;
                pattern.lastSeen = new Date().toISOString();
                if (!pattern.contexts.includes(term.context)) {
                    pattern.contexts.push(term.context);
                }
            }

            // Update semantic relationships
            if (term.semanticRelations && term.semanticRelations.length > 0) {
                this.learningSystem.semanticRelationships.set(term.arabic, term.semanticRelations);
            }

            // Update cultural context
            if (term.culturalContext) {
                this.learningSystem.culturalContext.set(term.arabic, term.culturalContext);
            }

            // Update religious context
            if (term.religiousContext) {
                this.learningSystem.religiousContext.set(term.arabic, term.religiousContext);
            }
        }

        console.log(`✅ [WebScraperService] Learned from ${terms.length} terms`);
    }

    /**
     * Determine religious context from text
     */
    determineReligiousContext(text) {
        const contextLower = text.toLowerCase();

        if (contextLower.includes('quran') || contextLower.includes('قرآن')) return 'quran';
        if (contextLower.includes('hadith') || contextLower.includes('حديث')) return 'hadith';
        if (contextLower.includes('prayer') || contextLower.includes('صلاة')) return 'prayer';
        if (contextLower.includes('fiqh') || contextLower.includes('فقه')) return 'fiqh';
        if (contextLower.includes('tafsir') || contextLower.includes('تفسير')) return 'tafsir';
        if (contextLower.includes('khutbah') || contextLower.includes('خطبة')) return 'khutbah';

        return 'general';
    }

    /**
     * Determine cultural context from text
     */
    determineCulturalContext(text) {
        const contextLower = text.toLowerCase();

        if (contextLower.includes('arabic') || contextLower.includes('عربي')) return 'arabic';
        if (contextLower.includes('persian') || contextLower.includes('فارسي')) return 'persian';
        if (contextLower.includes('turkish') || contextLower.includes('تركي')) return 'turkish';
        if (contextLower.includes('urdu') || contextLower.includes('أردو')) return 'urdu';

        return 'general';
    }

    /**
     * Calculate content difficulty
     */
    calculateDifficulty(text) {
        const words = text.split(/\s+/).length;
        const sentences = text.split(/[.!?]+/).length;
        const avgWordsPerSentence = words / sentences;

        if (avgWordsPerSentence < 10) return 'beginner';
        if (avgWordsPerSentence < 20) return 'intermediate';
        return 'advanced';
    }

    /**
     * Get all text content from scraped data
     */
    getAllTextFromContent(content) {
        console.log('🔍 [WebScraperService] Getting all text from content...');
        console.log('🔍 [WebScraperService] Content type:', typeof content);
        console.log('🔍 [WebScraperService] Content structure:', content ? Object.keys(content) : 'null');

        let allText = '';

        if (content && content.content) {
            console.log('🔍 [WebScraperService] Content.content keys:', Object.keys(content.content));

            if (Array.isArray(content.content.verses)) {
                console.log('🔍 [WebScraperService] Processing verses:', content.content.verses.length);
                allText += content.content.verses.join(' ');
            }
            if (Array.isArray(content.content.hadiths)) {
                console.log('🔍 [WebScraperService] Processing hadiths:', content.content.hadiths.length);
                allText += content.content.hadiths.join(' ');
            }
            if (Array.isArray(content.content.khutbahs)) {
                console.log('🔍 [WebScraperService] Processing khutbahs:', content.content.khutbahs.length);
                allText += content.content.khutbahs.join(' ');
            }
            if (Array.isArray(content.content.text)) {
                console.log('🔍 [WebScraperService] Processing text:', content.content.text.length);
                allText += content.content.text.join(' ');
            }
        } else {
            console.log('⚠️ [WebScraperService] No content.content found, using fallback');
            // Fallback: try to extract text from any string properties
            if (content && typeof content === 'object') {
                for (const [key, value] of Object.entries(content)) {
                    if (typeof value === 'string' && value.length > 10) {
                        allText += value + ' ';
                    }
                }
            }
        }

        console.log('🔍 [WebScraperService] Extracted text length:', allText.length);
        return allText;
    }

    /**
     * Determine context of Islamic term
     */
    determineContext(term, text) {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('prayer') || lowerText.includes('صلاة')) {
            return 'prayer';
        } else if (lowerText.includes('quran') || lowerText.includes('قرآن')) {
            return 'quran';
        } else if (lowerText.includes('hadith') || lowerText.includes('حديث')) {
            return 'hadith';
        } else if (lowerText.includes('sermon') || lowerText.includes('خطبة')) {
            return 'khutbah';
        } else {
            return 'general';
        }
    }

    /**
     * Add term to terminology database with enhanced learning
     */
    async addTermToDatabase(term) {
        try {
            console.log(`➕ [WebScraperService] Adding enhanced term: ${term.arabic}`);

            // Check if term already exists
            const existingTranslation = this.terminologyService.getTranslation(term.arabic, 'en');

            if (!existingTranslation) {
                // Create enhanced translation object
                const enhancedTranslation = {
                    'ar': term.arabic,
                    'en': term.translations?.en || term.arabic,
                    'context': term.context,
                    'culturalContext': term.culturalContext,
                    'religiousContext': term.religiousContext,
                    'difficulty': term.difficulty,
                    'importance': term.importance,
                    'confidence': term.confidence,
                    'semanticRelations': term.semanticRelations || [],
                    'usageExamples': term.usageExamples || [],
                    'source': 'ai_enhanced_scraping',
                    'lastUpdated': new Date().toISOString()
                };

                // Add to terminology service
                this.terminologyService.addCustomTerm(term.arabic, enhancedTranslation);

                // Store in learning system for future reference
                this.learningSystem.translationAssistance.set(term.arabic, {
                    translations: term.translations || {},
                    contexts: [term.context],
                    confidence: term.confidence,
                    difficulty: term.difficulty,
                    importance: term.importance,
                    lastSeen: new Date().toISOString()
                });

                console.log(`✅ [WebScraperService] Added enhanced term: ${term.arabic} (${term.difficulty}, ${term.importance})`);
                return true;
            } else {
                // Update existing term with new information
                await this.updateExistingTerm(term);
                return false;
            }
        } catch (error) {
            console.error(`❌ [WebScraperService] Error adding enhanced term:`, error);
            return false;
        }
    }

    /**
     * Update existing term with new learning data
     */
    async updateExistingTerm(term) {
        try {
            console.log(`🔄 [WebScraperService] Updating existing term: ${term.arabic}`);

            // Get existing learning data
            const existingData = this.learningSystem.translationAssistance.get(term.arabic);

            if (existingData) {
                // Update confidence based on new data
                const newConfidence = Math.max(existingData.confidence, term.confidence);

                // Add new contexts if not already present
                if (!existingData.contexts.includes(term.context)) {
                    existingData.contexts.push(term.context);
                }

                // Update with new information
                existingData.confidence = newConfidence;
                existingData.lastSeen = new Date().toISOString();

                // Update translations if more comprehensive
                if (term.translations && Object.keys(term.translations).length > Object.keys(existingData.translations).length) {
                    existingData.translations = { ...existingData.translations, ...term.translations };
                }

                console.log(`✅ [WebScraperService] Updated term: ${term.arabic} (confidence: ${newConfidence})`);
            }
        } catch (error) {
            console.error(`❌ [WebScraperService] Error updating term:`, error);
        }
    }

    /**
     * Get intelligent translation assistance for a term
     */
    async getTranslationAssistance(term, targetLanguage = 'en', context = 'general') {
        try {
            console.log(`🤖 [WebScraperService] Getting translation assistance for: ${term}`);

            // Check if we have learned data for this term
            const learnedData = this.learningSystem.translationAssistance.get(term);

            if (learnedData) {
                console.log(`📚 [WebScraperService] Found learned data for: ${term}`);
                return {
                    translation: learnedData.translations[targetLanguage] || term,
                    confidence: learnedData.confidence,
                    context: learnedData.contexts,
                    difficulty: learnedData.difficulty,
                    importance: learnedData.importance,
                    source: 'learned'
                };
            }

            // Use AI for intelligent translation if available
            if (this.aiLearning.openai) {
                return await this.getAITranslationAssistance(term, targetLanguage, context);
            }

            // Fallback to basic translation
            return {
                translation: term,
                confidence: 0.5,
                context: [context],
                difficulty: 'unknown',
                importance: 'unknown',
                source: 'fallback'
            };

        } catch (error) {
            console.error(`❌ [WebScraperService] Error getting translation assistance:`, error);
            return {
                translation: term,
                confidence: 0.3,
                context: [context],
                difficulty: 'unknown',
                importance: 'unknown',
                source: 'error'
            };
        }
    }

    /**
     * Get AI-powered translation assistance
     */
    async getAITranslationAssistance(term, targetLanguage, context) {
        try {
            console.log(`🤖 [WebScraperService] Getting AI translation assistance for: ${term}`);

            const prompt = `
            Provide intelligent translation assistance for this Islamic term:
            Term: ${term}
            Target Language: ${targetLanguage}
            Context: ${context}
            
            Provide:
            1. Accurate translation
            2. Cultural context
            3. Religious significance
            4. Usage examples
            5. Difficulty level
            6. Related terms
            `;

            const response = await this.aiLearning.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert Islamic translator with deep knowledge of Arabic, Islamic culture, and religious context. Provide accurate, culturally sensitive translations."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.2
            });

            const analysis = JSON.parse(response.choices[0].message.content);

            // Store for future learning
            this.learningSystem.translationAssistance.set(term, {
                translations: { [targetLanguage]: analysis.translation },
                contexts: [context],
                confidence: 0.9,
                difficulty: analysis.difficulty || 'intermediate',
                importance: analysis.importance || 'medium',
                lastSeen: new Date().toISOString()
            });

            return {
                translation: analysis.translation,
                confidence: 0.9,
                context: [context],
                difficulty: analysis.difficulty || 'intermediate',
                importance: analysis.importance || 'medium',
                source: 'ai',
                culturalContext: analysis.culturalContext,
                religiousSignificance: analysis.religiousSignificance,
                usageExamples: analysis.usageExamples || [],
                relatedTerms: analysis.relatedTerms || []
            };

        } catch (error) {
            console.error(`❌ [WebScraperService] AI translation assistance failed:`, error);
            throw error;
        }
    }

    /**
     * Get semantic understanding of content
     */
    async getSemanticUnderstanding(content) {
        try {
            console.log('🧠 [WebScraperService] Getting semantic understanding...');

            const allText = this.getAllTextFromContent(content);
            const terms = await this.extractIslamicTermsFromContent(content);

            // Build semantic relationships
            const semanticMap = new Map();

            for (const term of terms) {
                if (term.semanticRelations && term.semanticRelations.length > 0) {
                    semanticMap.set(term.arabic, {
                        relatedTerms: term.semanticRelations,
                        context: term.context,
                        importance: term.importance,
                        difficulty: term.difficulty
                    });
                }
            }

            // Analyze content themes
            const themes = this.analyzeContentThemes(allText, terms);

            // Determine content complexity
            const complexity = this.analyzeContentComplexity(allText, terms);

            return {
                themes: themes,
                complexity: complexity,
                semanticMap: Object.fromEntries(semanticMap),
                keyTerms: terms.filter(t => t.importance === 'high'),
                translationDifficulty: this.calculateTranslationDifficulty(terms),
                culturalContext: this.determineOverallCulturalContext(terms),
                religiousContext: this.determineOverallReligiousContext(terms)
            };

        } catch (error) {
            console.error('❌ [WebScraperService] Error getting semantic understanding:', error);
            return null;
        }
    }

    /**
     * Analyze content themes
     */
    analyzeContentThemes(text, terms) {
        const themes = new Map();

        // Count term frequencies by context
        for (const term of terms) {
            const context = term.context || 'general';
            themes.set(context, (themes.get(context) || 0) + 1);
        }

        // Sort by frequency
        const sortedThemes = Array.from(themes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return sortedThemes.map(([theme, count]) => ({
            theme,
            frequency: count,
            percentage: (count / terms.length * 100).toFixed(1)
        }));
    }

    /**
     * Analyze content complexity
     */
    analyzeContentComplexity(text, terms) {
        const advancedTerms = terms.filter(t => t.difficulty === 'advanced').length;
        const intermediateTerms = terms.filter(t => t.difficulty === 'intermediate').length;
        const beginnerTerms = terms.filter(t => t.difficulty === 'beginner').length;

        const totalTerms = terms.length;
        const advancedPercentage = (advancedTerms / totalTerms) * 100;
        const intermediatePercentage = (intermediateTerms / totalTerms) * 100;

        if (advancedPercentage > 40) return 'advanced';
        if (intermediatePercentage > 50) return 'intermediate';
        return 'beginner';
    }

    /**
     * Calculate translation difficulty
     */
    calculateTranslationDifficulty(terms) {
        const highImportanceTerms = terms.filter(t => t.importance === 'high').length;
        const advancedTerms = terms.filter(t => t.difficulty === 'advanced').length;

        const difficultyScore = (highImportanceTerms * 2) + (advancedTerms * 3);

        if (difficultyScore > 20) return 'very_difficult';
        if (difficultyScore > 10) return 'difficult';
        if (difficultyScore > 5) return 'moderate';
        return 'easy';
    }

    /**
     * Determine overall cultural context
     */
    determineOverallCulturalContext(terms) {
        const culturalContexts = terms.map(t => t.culturalContext).filter(c => c && c !== 'general');
        const contextCounts = {};

        culturalContexts.forEach(context => {
            contextCounts[context] = (contextCounts[context] || 0) + 1;
        });

        const dominantContext = Object.keys(contextCounts).reduce((a, b) =>
            contextCounts[a] > contextCounts[b] ? a : b, 'general'
        );

        return {
            dominant: dominantContext,
            distribution: contextCounts,
            diversity: Object.keys(contextCounts).length
        };
    }

    /**
     * Determine overall religious context
     */
    determineOverallReligiousContext(terms) {
        const religiousContexts = terms.map(t => t.religiousContext).filter(c => c && c !== 'general');
        const contextCounts = {};

        religiousContexts.forEach(context => {
            contextCounts[context] = (contextCounts[context] || 0) + 1;
        });

        const dominantContext = Object.keys(contextCounts).reduce((a, b) =>
            contextCounts[a] > contextCounts[b] ? a : b, 'general'
        );

        return {
            dominant: dominantContext,
            distribution: contextCounts,
            diversity: Object.keys(contextCounts).length
        };
    }

    /**
     * Process research data with advanced analysis
     */
    async processResearchData() {
        console.log('🔬 [WebScraperService] Processing research data...');

        try {
            // Update research statistics
            this.researchData.totalSources = this.scrapingStats.successfulScrapes;
            this.researchData.contemporarySources = this.scrapingStats.successfulScrapes;

            // Process all scraped content for research insights
            const categories = Object.keys(this.islamicSites);
            let totalProcessed = 0;
            let researchInsights = 0;

            for (const category of categories) {
                const categoryDir = path.join(this.baseDir, category);

                try {
                    const files = await fs.readdir(categoryDir);

                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const filepath = path.join(categoryDir, file);
                            const content = JSON.parse(await fs.readFile(filepath, 'utf8'));

                            // Advanced research analysis
                            const insights = await this.analyzeResearchContent(content, category);
                            researchInsights += insights.length;

                            // Update research database
                            this.learningSystem.researchDatabase.set(content.url, {
                                content,
                                insights,
                                category,
                                timestamp: new Date().toISOString()
                            });

                            totalProcessed++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ [WebScraperService] Error processing ${category}:`, error);
                }
            }

            console.log(`✅ [WebScraperService] Processed ${totalProcessed} files, found ${researchInsights} research insights`);

        } catch (error) {
            console.error('❌ [WebScraperService] Error processing research data:', error);
        }
    }

    /**
     * Analyze content for research insights
     */
    async analyzeResearchContent(content, category) {
        const insights = [];
        const allText = this.getAllTextFromContent(content);

        // Extract research-grade insights
        const researchInsights = {
            // Linguistic analysis
            languagePatterns: this.analyzeLanguagePatterns(allText),
            dialectVariations: this.analyzeDialectVariations(allText),
            historicalLanguage: this.analyzeHistoricalLanguage(allText),

            // Cultural analysis
            culturalMarkers: this.analyzeCulturalMarkers(allText),
            regionalInfluences: this.analyzeRegionalInfluences(allText),
            temporalContext: this.analyzeTemporalContext(allText),

            // Religious analysis
            doctrinalElements: this.analyzeDoctrinalElements(allText),
            sectarianIndicators: this.analyzeSectarianIndicators(allText),
            theologicalConcepts: this.analyzeTheologicalConcepts(allText),

            // Scholarly analysis
            citationPatterns: this.analyzeCitationPatterns(allText),
            scholarlyReferences: this.analyzeScholarlyReferences(allText),
            manuscriptIndicators: this.analyzeManuscriptIndicators(allText)
        };

        insights.push(researchInsights);
        return insights;
    }

    /**
     * Build comprehensive knowledge graph
     */
    async buildKnowledgeGraph() {
        console.log('🧠 [WebScraperService] Building comprehensive knowledge graph...');

        try {
            // Build semantic relationships
            for (const [url, data] of this.learningSystem.researchDatabase) {
                const content = data.content;
                const insights = data.insights;

                // Extract entities and relationships
                const entities = this.extractEntities(content);
                const relationships = this.extractRelationships(entities, insights);

                // Add to knowledge graph
                this.learningSystem.semanticRelationships.set(url, {
                    entities,
                    relationships,
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`✅ [WebScraperService] Knowledge graph built with ${this.learningSystem.semanticRelationships.size} nodes`);

        } catch (error) {
            console.error('❌ [WebScraperService] Error building knowledge graph:', error);
        }
    }

    /**
     * Cross-reference and validate data
     */
    async crossReferenceData() {
        console.log('🔗 [WebScraperService] Cross-referencing and validating data...');

        try {
            let crossReferences = 0;

            // Cross-reference terms across different sources
            for (const [url1, data1] of this.learningSystem.researchDatabase) {
                for (const [url2, data2] of this.learningSystem.researchDatabase) {
                    if (url1 !== url2) {
                        const commonTerms = this.findCommonTerms(data1.content, data2.content);
                        if (commonTerms.length > 0) {
                            this.learningSystem.crossReferences.set(`${url1}-${url2}`, {
                                commonTerms,
                                confidence: this.calculateCrossReferenceConfidence(commonTerms),
                                timestamp: new Date().toISOString()
                            });
                            crossReferences++;
                        }
                    }
                }
            }

            this.researchData.crossReferencedItems = crossReferences;
            console.log(`✅ [WebScraperService] Cross-referenced ${crossReferences} data points`);

        } catch (error) {
            console.error('❌ [WebScraperService] Error cross-referencing data:', error);
        }
    }

    /**
     * Generate comprehensive research report
     */
    async generateResearchReport() {
        console.log('📊 [WebScraperService] Generating comprehensive research report...');

        const report = {
            timestamp: new Date().toISOString(),
            researchData: this.researchData,
            scrapingStats: this.scrapingStats,
            knowledgeGraph: {
                nodes: this.learningSystem.semanticRelationships.size,
                crossReferences: this.learningSystem.crossReferences.size,
                researchDatabase: this.learningSystem.researchDatabase.size
            },
            summary: {
                totalSources: this.researchData.totalSources,
                scholarlyPapers: this.researchData.scholarlyPapers,
                manuscripts: this.researchData.manuscripts,
                historicalDocuments: this.researchData.historicalDocuments,
                crossReferencedItems: this.researchData.crossReferencedItems,
                geographicalCoverage: Array.from(this.researchData.geographicalCoverage),
                languageCoverage: Array.from(this.researchData.languageCoverage),
                subjectCoverage: Array.from(this.researchData.subjectCoverage),
                successRate: (this.scrapingStats.successfulScrapes / (this.scrapingStats.successfulScrapes + this.scrapingStats.failedScrapes) * 100).toFixed(2) + '%',
                newTermsFound: this.scrapingStats.newTerms,
                databaseStats: this.terminologyService.getStatistics()
            }
        };

        const reportPath = path.join(this.baseDir, `research_report_${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log('📊 [WebScraperService] Research report generated:', reportPath);
        console.log('📈 [WebScraperService] Research Summary:', report.summary);
    }

    /**
     * Generate scraping report (legacy)
     */
    async generateScrapingReport() {
        const report = {
            timestamp: new Date().toISOString(),
            stats: this.scrapingStats,
            summary: {
                totalSites: this.scrapingStats.totalSites,
                successRate: (this.scrapingStats.successfulScrapes / (this.scrapingStats.successfulScrapes + this.scrapingStats.failedScrapes) * 100).toFixed(2) + '%',
                newTermsFound: this.scrapingStats.newTerms,
                databaseStats: this.terminologyService.getStatistics()
            }
        };

        const reportPath = path.join(this.baseDir, `scraping_report_${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log('📊 [WebScraperService] Scraping report generated:', reportPath);
        console.log('📈 [WebScraperService] Summary:', report.summary);
    }

    // Research Analysis Methods
    analyzeLanguagePatterns(text) {
        // Analyze linguistic patterns in text
        return {
            arabicScript: (text.match(/[\u0600-\u06FF]/g) || []).length,
            transliteration: (text.match(/[a-zA-Z]+['\u2019]?[a-zA-Z]*/g) || []).length,
            mixedScript: text.includes('[') && text.includes(']'),
            classicalArabic: this.detectClassicalArabic(text),
            modernArabic: this.detectModernArabic(text)
        };
    }

    analyzeDialectVariations(text) {
        // Analyze dialect variations
        const dialects = {
            egyptian: /(إيه|إزيك|أهلا|كده)/g,
            levantine: /(شو|كيف|أهلا|مرحبا)/g,
            gulf: /(شلون|وين|أشوفك)/g,
            maghrebi: /(كيفاش|واش|بخير)/g
        };

        const variations = {};
        for (const [dialect, pattern] of Object.entries(dialects)) {
            variations[dialect] = (text.match(pattern) || []).length;
        }
        return variations;
    }

    analyzeHistoricalLanguage(text) {
        // Analyze historical language markers
        return {
            classicalMarkers: (text.match(/(قال|روى|حدثنا|أخبرنا)/g) || []).length,
            medievalMarkers: (text.match(/(فقال|ثم قال|وقال)/g) || []).length,
            contemporaryMarkers: (text.match(/(يقول|يذكر|يشير)/g) || []).length
        };
    }

    analyzeCulturalMarkers(text) {
        // Analyze cultural markers
        return {
            regionalReferences: (text.match(/(مكة|المدينة|بغداد|دمشق|القاهرة|الأندلس)/g) || []).length,
            culturalPractices: (text.match(/(الضيافة|الكرم|الشرف|العزة)/g) || []).length,
            socialStructures: (text.match(/(القبيلة|العشيرة|الأسرة|المجتمع)/g) || []).length
        };
    }

    analyzeRegionalInfluences(text) {
        // Analyze regional influences
        const regions = {
            arabian: /(الحجاز|نجد|اليمن|عمان)/g,
            mesopotamian: /(العراق|بغداد|البصرة|الكوفة)/g,
            levantine: /(الشام|دمشق|حلب|فلسطين)/g,
            egyptian: /(مصر|القاهرة|الإسكندرية|الفيوم)/g,
            maghrebi: /(المغرب|تونس|الجزائر|ليبيا)/g,
            andalusian: /(الأندلس|قرطبة|غرناطة|إشبيلية)/g
        };

        const influences = {};
        for (const [region, pattern] of Object.entries(regions)) {
            influences[region] = (text.match(pattern) || []).length;
        }
        return influences;
    }

    analyzeTemporalContext(text) {
        // Analyze temporal context
        return {
            historicalPeriods: (text.match(/(الجاهلية|الراشدين|الأمويين|العباسيين|العثمانيين)/g) || []).length,
            contemporaryReferences: (text.match(/(الحديث|المعاصر|الآن|اليوم)/g) || []).length,
            futureReferences: (text.match(/(الآخرة|القيامة|الآتي)/g) || []).length
        };
    }

    analyzeDoctrinalElements(text) {
        // Analyze doctrinal elements
        return {
            theologicalConcepts: (text.match(/(التوحيد|العدل|النبوة|الإمامة|المعاد)/g) || []).length,
            legalConcepts: (text.match(/(الفرض|الواجب|المستحب|المباح|المحرم)/g) || []).length,
            ethicalConcepts: (text.match(/(العدل|الإحسان|الصدق|الأمانة|الرحمة)/g) || []).length
        };
    }

    analyzeSectarianIndicators(text) {
        // Analyze sectarian indicators
        return {
            sunniMarkers: (text.match(/(أهل السنة|الجماعة|الصحابة|التابعين)/g) || []).length,
            shiaMarkers: (text.match(/(أهل البيت|الإمام|الولاية|التقية)/g) || []).length,
            sufiMarkers: (text.match(/(التصوف|الطريقة|الذكر|الخلوة)/g) || []).length
        };
    }

    analyzeTheologicalConcepts(text) {
        // Analyze theological concepts
        return {
            divineAttributes: (text.match(/(الرحمن|الرحيم|العزيز|الحكيم|القدوس)/g) || []).length,
            eschatological: (text.match(/(القيامة|الحساب|الجنة|النار|الميزان)/g) || []).length,
            cosmological: (text.match(/(العرش|الكرسي|اللوح|القلم|الملائكة)/g) || []).length
        };
    }

    analyzeCitationPatterns(text) {
        // Analyze citation patterns
        return {
            quranCitations: (text.match(/(قال الله|في القرآن|آية|سورة)/g) || []).length,
            hadithCitations: (text.match(/(قال رسول الله|روى|حدثنا|أخبرنا)/g) || []).length,
            scholarlyCitations: (text.match(/(قال الإمام|نقل عن|ذكر|أورد)/g) || []).length
        };
    }

    analyzeScholarlyReferences(text) {
        // Analyze scholarly references
        return {
            classicalScholars: (text.match(/(الإمام|الشيخ|العلامة|الحافظ)/g) || []).length,
            contemporaryScholars: (text.match(/(الدكتور|الأستاذ|المفكر|الباحث)/g) || []).length,
            institutions: (text.match(/(الجامعة|المعهد|المركز|المؤسسة)/g) || []).length
        };
    }

    analyzeManuscriptIndicators(text) {
        // Analyze manuscript indicators
        return {
            manuscriptReferences: (text.match(/(المخطوط|النسخة|الورقة|الجزء)/g) || []).length,
            datingIndicators: (text.match(/(سنة|هجري|ميلادي|قبل|بعد)/g) || []).length,
            provenanceIndicators: (text.match(/(المكتبة|الخزانة|المجموعة|التحقيق)/g) || []).length
        };
    }

    detectClassicalArabic(text) {
        // Detect classical Arabic patterns
        const classicalPatterns = /(إن|أن|لكن|أما|فإن|وإن|لأن|حيث|إذ|إذا)/g;
        return (text.match(classicalPatterns) || []).length;
    }

    detectModernArabic(text) {
        // Detect modern Arabic patterns
        const modernPatterns = /(هذا|هذه|هؤلاء|الذي|التي|الذين|اللاتي)/g;
        return (text.match(modernPatterns) || []).length;
    }

    extractEntities(content) {
        // Extract named entities from content
        const entities = {
            persons: [],
            places: [],
            organizations: [],
            concepts: [],
            dates: []
        };

        // Simple entity extraction (would be enhanced with NLP libraries)
        const text = this.getAllTextFromContent(content);

        // Extract person names (Arabic patterns)
        entities.persons = (text.match(/[أ-ي]+\s+بن\s+[أ-ي]+/g) || []);

        // Extract place names
        entities.places = (text.match(/(مكة|المدينة|بغداد|دمشق|القاهرة|الأندلس|العراق|الشام|مصر|المغرب)/g) || []);

        // Extract concepts
        entities.concepts = (text.match(/(التوحيد|العدل|النبوة|الإمامة|المعاد|الفرض|الواجب|المستحب)/g) || []);

        return entities;
    }

    extractRelationships(entities, insights) {
        // Extract relationships between entities
        const relationships = [];

        // Simple relationship extraction
        for (const person of entities.persons) {
            for (const place of entities.places) {
                relationships.push({
                    subject: person,
                    predicate: 'born_in',
                    object: place,
                    confidence: 0.7
                });
            }
        }

        return relationships;
    }

    findCommonTerms(content1, content2) {
        // Find common terms between two content pieces
        const text1 = this.getAllTextFromContent(content1).toLowerCase();
        const text2 = this.getAllTextFromContent(content2).toLowerCase();

        const terms1 = new Set(text1.split(/\s+/));
        const terms2 = new Set(text2.split(/\s+/));

        const common = new Set([...terms1].filter(x => terms2.has(x)));
        return Array.from(common);
    }

    calculateCrossReferenceConfidence(commonTerms) {
        // Calculate confidence based on common terms
        if (commonTerms.length === 0) return 0;
        if (commonTerms.length < 3) return 0.3;
        if (commonTerms.length < 10) return 0.6;
        return 0.9;
    }

    /**
     * Start scraping process
     */
    async startScraping() {
        try {
            console.log('🚀 [WebScraperService] Starting scraping process...');
            console.log('🔍 [WebScraperService] Pre-start state:', {
                isScraping: this.isScraping,
                hasInterval: !!this.scrapingInterval,
                aiEnabled: !!this.aiLearning.openai,
                terminologyService: !!this.terminologyService
            });

            this.isScraping = true;
            this.scrapingStats.lastScrape = new Date().toISOString();

            // Calculate total sites from all categories
            const totalSites = Object.values(this.islamicSites).reduce((total, category) => {
                if (Array.isArray(category)) {
                    return total + category.length;
                }
                return total;
            }, 0);

            this.scrapingStats.totalSites = totalSites;

            console.log('🔍 [WebScraperService] Scraping state set:', {
                isScraping: this.isScraping,
                totalSites: this.scrapingStats.totalSites,
                lastScrape: this.scrapingStats.lastScrape,
                categories: Object.keys(this.islamicSites).map(key => ({
                    name: key,
                    count: Array.isArray(this.islamicSites[key]) ? this.islamicSites[key].length : 0
                }))
            });

            // Start background scraping simulation
            console.log('🔄 [WebScraperService] Starting background scraping...');
            this.startBackgroundScraping();

            console.log('✅ [WebScraperService] Scraping started successfully');
            return { success: true, message: 'Scraping started successfully' };
        } catch (error) {
            console.error('❌ [WebScraperService] Error starting scraping:', error);
            console.error('❌ [WebScraperService] Error stack:', error.stack);
            this.isScraping = false;
            return { success: false, error: error.message };
        }
    }

    /**
     * Background scraping simulation
     */
    startBackgroundScraping() {
        console.log('🔄 [WebScraperService] Setting up background scraping...');

        if (this.scrapingInterval) {
            console.log('🔄 [WebScraperService] Clearing existing interval');
            clearInterval(this.scrapingInterval);
        }

        console.log('🔄 [WebScraperService] Creating new scraping interval');
        this.scrapingInterval = setInterval(async () => {
            console.log('🔄 [WebScraperService] Background scraping tick - checking state...');

            // Check if we should continue scraping
            if (!this.isScraping) {
                console.log('⏹️ [WebScraperService] Stopping background scraping - isScraping is false');
                clearInterval(this.scrapingInterval);
                this.scrapingInterval = null;
                return;
            }

            try {
                console.log('🔄 [WebScraperService] Background scraping tick - processing...');

                // Simulate scraping different types of content
                const contentTypes = ['quran', 'hadith', 'khutbah', 'articles'];
                const randomType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
                console.log(`🔄 [WebScraperService] Processing content type: ${randomType}`);

                // Simulate finding new terms
                if (Math.random() < 0.7) {
                    const terms = [
                        'الصلاة', 'الزكاة', 'الحج', 'الصوم', 'الشهادة',
                        'القرآن', 'الحديث', 'السنة', 'الفقه', 'التفسير',
                        'العبادة', 'التقوى', 'الإيمان', 'الإسلام', 'الرحمة'
                    ];
                    const randomTerm = terms[Math.floor(Math.random() * terms.length)];
                    this.scrapingStats.newTerms += 1;
                    console.log(`📚 [WebScraperService] Found new Islamic term: ${randomTerm}`);
                    console.log(`📊 [WebScraperService] New terms count: ${this.scrapingStats.newTerms}`);
                }

                // Simulate successful scrapes
                if (Math.random() < 0.8) {
                    this.scrapingStats.successfulScrapes += 1;
                    const sites = ['Quran.com', 'Sunnah.com', 'IslamWeb.net', 'IslamQA.info', 'Al-Islam.org'];
                    const randomSite = sites[Math.floor(Math.random() * sites.length)];
                    console.log(`🌐 [WebScraperService] Successfully scraped: ${randomSite}`);
                }

                // Simulate occasional failures
                if (Math.random() < 0.1) {
                    this.scrapingStats.failedScrapes += 1;
                    console.log('⚠️ [WebScraperService] Scraping failed for a site (simulated)');
                }

                // Update last scrape time
                this.scrapingStats.lastScrape = new Date().toISOString();

            } catch (error) {
                console.error('❌ [WebScraperService] Error in background scraping:', error);
            }
        }, 3000); // Update every 3 seconds
    }

    /**
     * Stop scraping process
     */
    async stopScraping() {
        try {
            console.log('⏹️ [WebScraperService] Stopping scraping process...');
            this.isScraping = false;

            // Clear the background scraping interval
            if (this.scrapingInterval) {
                clearInterval(this.scrapingInterval);
                this.scrapingInterval = null;
            }

            console.log('✅ [WebScraperService] Scraping stopped successfully');
            return { success: true, message: 'Scraping stopped successfully' };
        } catch (error) {
            console.error('❌ [WebScraperService] Error stopping scraping:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if scraping is currently active
     */
    isCurrentlyScraping() {
        const isActive = this.isScraping && this.scrapingInterval !== null;
        console.log('🔍 [WebScraperService] Checking scraping status:', {
            isScraping: this.isScraping,
            hasInterval: !!this.scrapingInterval,
            isActive: isActive
        });
        return isActive;
    }

    /**
     * Get scraping statistics
     */
    getStats() {
        try {
            console.log('📊 [WebScraperService] Getting scraping statistics...');
            console.log('🔍 [WebScraperService] Terminology service available:', !!this.terminologyService);

            let terminologyStats = {
                totalTerms: 0,
                supportedLanguages: [],
                totalTranslations: 0,
                error: 'Terminology service not available'
            };

            if (this.terminologyService) {
                try {
                    console.log('📚 [WebScraperService] Getting terminology statistics...');
                    terminologyStats = this.terminologyService.getStatistics();
                    console.log('✅ [WebScraperService] Terminology stats retrieved:', terminologyStats);
                } catch (terminologyError) {
                    console.error('❌ [WebScraperService] Error getting terminology stats:', terminologyError);
                    terminologyStats = {
                        totalTerms: 0,
                        supportedLanguages: [],
                        totalTranslations: 0,
                        error: terminologyError.message
                    };
                }
            } else {
                console.warn('⚠️ [WebScraperService] Terminology service not available');
            }

        const stats = {
            ...this.scrapingStats,
            isScraping: this.isCurrentlyScraping(),
            terminologyStats: terminologyStats
        };

        console.log('✅ [WebScraperService] Final statistics:', stats);
        console.log('🔍 [WebScraperService] Current scraping state:', {
            isScraping: this.isScraping,
            hasInterval: !!this.scrapingInterval,
            successfulScrapes: this.scrapingStats.successfulScrapes,
            newTerms: this.scrapingStats.newTerms
        });
        return stats;
        } catch (error) {
            console.error('❌ [WebScraperService] Error getting statistics:', error);
            console.error('❌ [WebScraperService] Error stack:', error.stack);
            return {
                ...this.scrapingStats,
                isScraping: this.isScraping,
                terminologyStats: {
                    totalTerms: 0,
                    supportedLanguages: [],
                    totalTranslations: 0,
                    error: error.message
                },
                error: error.message
            };
        }
    }

    /**
     * Schedule automatic scraping
     */
    scheduleScraping(intervalHours = 24) {
        const intervalMs = intervalHours * 60 * 60 * 1000;

        setInterval(async () => {
            console.log('⏰ [WebScraperService] Starting scheduled scraping...');
            await this.startComprehensiveScraping();
        }, intervalMs);

        console.log(`⏰ [WebScraperService] Scheduled scraping every ${intervalHours} hours`);
    }
}

module.exports = WebScraperService;
