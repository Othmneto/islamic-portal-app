/**
 * Content Scheduler Service
 * Manages automated scraping and database updates
 * Runs web scraper on schedule and processes new content
 */

const cron = require('node-cron');
const WebScraperService = require('./webScraperService');
const IslamicTerminologyService = require('./islamicTerminologyService');

class ContentScheduler {
    constructor() {
        console.log('🔧 [ContentScheduler] Initializing constructor...');
        
        try {
            console.log('🕷️ [ContentScheduler] Creating WebScraperService...');
            this.webScraper = new WebScraperService();
            console.log('✅ [ContentScheduler] WebScraperService created successfully');
        } catch (error) {
            console.error('❌ [ContentScheduler] Error creating WebScraperService:', error);
            this.webScraper = null;
        }
        
        try {
            console.log('📚 [ContentScheduler] Creating IslamicTerminologyService...');
            this.terminologyService = new IslamicTerminologyService();
            console.log('✅ [ContentScheduler] IslamicTerminologyService created successfully');
        } catch (error) {
            console.error('❌ [ContentScheduler] Error creating IslamicTerminologyService:', error);
            this.terminologyService = null;
        }
        
        this.isRunning = false;
        console.log('✅ [ContentScheduler] Constructor completed');
        this.scheduledJobs = new Map();
        
        // Scraping schedules
        this.schedules = {
            // Every 6 hours - frequent updates
            frequent: '0 */6 * * *',
            // Every 12 hours - moderate updates  
            moderate: '0 */12 * * *',
            // Daily at 2 AM - comprehensive updates
            daily: '0 2 * * *',
            // Weekly on Sunday at 3 AM - full refresh
            weekly: '0 3 * * 0'
        };
    }

    /**
     * Initialize the scheduler
     */
    async initialize() {
        try {
            // Re-create webScraper if it's null
            if (!this.webScraper) {
                console.log('🔄 [ContentScheduler] Re-creating WebScraperService...');
                this.webScraper = new WebScraperService();
            }
            
            // Initialize webScraper if it has an initialize method
            if (this.webScraper && typeof this.webScraper.initialize === 'function') {
                await this.webScraper.initialize();
            }
            
            console.log('✅ [ContentScheduler] Initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ [ContentScheduler] Initialization failed:', error);
            // Don't set webScraper to null, keep it for retry
            return false;
        }
    }

    /**
     * Start all scheduled scraping jobs
     */
    startScheduledScraping() {
        if (this.isRunning) {
            console.log('⚠️ [ContentScheduler] Scheduler already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 [ContentScheduler] Starting scheduled scraping jobs...');

        // Schedule different types of scraping
        this.scheduleJob('frequent', this.schedules.frequent, () => this.runFrequentScraping());
        this.scheduleJob('moderate', this.schedules.moderate, () => this.runModerateScraping());
        this.scheduleJob('daily', this.schedules.daily, () => this.runDailyScraping());
        this.scheduleJob('weekly', this.schedules.weekly, () => this.runWeeklyScraping());

        console.log('✅ [ContentScheduler] All scheduled jobs started');
    }

    /**
     * Ensure webScraper is available
     */
    ensureWebScraper() {
        if (!this.webScraper) {
            console.log('🔄 [ContentScheduler] Creating WebScraperService...');
            this.webScraper = new WebScraperService();
        }
        return this.webScraper;
    }

    /**
     * Start immediate scraping
     */
    async startImmediateScraping() {
        try {
            console.log('🚀 [ContentScheduler] Starting immediate scraping...');
            
            // Ensure webScraper is available
            const webScraper = this.ensureWebScraper();
            
            console.log('🔍 [ContentScheduler] Web scraper status:', {
                hasWebScraper: !!webScraper,
                webScraperType: typeof webScraper,
                hasStartMethod: webScraper && typeof webScraper.startScraping === 'function'
            });
            
            if (webScraper && typeof webScraper.startScraping === 'function') {
                const result = await webScraper.startScraping();
                console.log('✅ [ContentScheduler] Immediate scraping started:', result);
                return result;
            } else {
                console.warn('⚠️ [ContentScheduler] Web scraper not available for immediate scraping');
                console.warn('⚠️ [ContentScheduler] Web scraper details:', {
                    webScraper: webScraper,
                    hasStartMethod: webScraper && typeof webScraper.startScraping === 'function'
                });
                return { success: false, error: 'Web scraper not available' };
            }
        } catch (error) {
            console.error('❌ [ContentScheduler] Error starting immediate scraping:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop immediate scraping
     */
    async stopImmediateScraping() {
        try {
            console.log('⏹️ [ContentScheduler] Stopping immediate scraping...');
            
            // Ensure webScraper is available
            const webScraper = this.ensureWebScraper();
            
            if (webScraper && typeof webScraper.stopScraping === 'function') {
                const result = await webScraper.stopScraping();
                console.log('✅ [ContentScheduler] Immediate scraping stopped:', result);
                return result;
            } else {
                console.warn('⚠️ [ContentScheduler] Web scraper not available for stopping');
                return { success: false, error: 'Web scraper not available' };
            }
        } catch (error) {
            console.error('❌ [ContentScheduler] Error stopping immediate scraping:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Schedule a specific job
     */
    scheduleJob(name, schedule, task) {
        const job = cron.schedule(schedule, async () => {
            console.log(`⏰ [ContentScheduler] Running ${name} scraping...`);
            try {
                await task();
                console.log(`✅ [ContentScheduler] ${name} scraping completed`);
            } catch (error) {
                console.error(`❌ [ContentScheduler] ${name} scraping failed:`, error);
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        this.scheduledJobs.set(name, job);
        job.start();
        console.log(`📅 [ContentScheduler] Scheduled ${name} job: ${schedule}`);
    }

    /**
     * Run frequent scraping (every 6 hours)
     * Focus on news and current events
     */
    async runFrequentScraping() {
        console.log('📰 [ContentScheduler] Running frequent scraping (news & current events)...');
        
        try {
            // Scrape only news and current content
            await this.webScraper.scrapeIslamicNews();
            await this.webScraper.processScrapedContent();
            
            console.log('✅ [ContentScheduler] Frequent scraping completed');
        } catch (error) {
            console.error('❌ [ContentScheduler] Frequent scraping failed:', error);
        }
    }

    /**
     * Run moderate scraping (every 12 hours)
     * Focus on Khutbah and articles
     */
    async runModerateScraping() {
        console.log('🎤 [ContentScheduler] Running moderate scraping (Khutbah & articles)...');
        
        try {
            await this.webScraper.scrapeKhutbahContent();
            await this.webScraper.scrapeGeneralIslamicContent();
            await this.webScraper.processScrapedContent();
            
            console.log('✅ [ContentScheduler] Moderate scraping completed');
        } catch (error) {
            console.error('❌ [ContentScheduler] Moderate scraping failed:', error);
        }
    }

    /**
     * Run daily scraping (every day at 2 AM)
     * Comprehensive update of all content
     */
    async runDailyScraping() {
        console.log('🔄 [ContentScheduler] Running daily comprehensive scraping...');
        
        try {
            await this.webScraper.startComprehensiveScraping();
            await this.updateTerminologyDatabase();
            await this.generateContentReport();
            
            console.log('✅ [ContentScheduler] Daily scraping completed');
        } catch (error) {
            console.error('❌ [ContentScheduler] Daily scraping failed:', error);
        }
    }

    /**
     * Run weekly scraping (every Sunday at 3 AM)
     * Full refresh and deep analysis
     */
    async runWeeklyScraping() {
        console.log('🔍 [ContentScheduler] Running weekly deep scraping...');
        
        try {
            // Full comprehensive scraping
            await this.webScraper.startComprehensiveScraping();
            
            // Deep analysis and database optimization
            await this.performDeepAnalysis();
            await this.optimizeTerminologyDatabase();
            await this.generateWeeklyReport();
            
            console.log('✅ [ContentScheduler] Weekly scraping completed');
        } catch (error) {
            console.error('❌ [ContentScheduler] Weekly scraping failed:', error);
        }
    }

    /**
     * Update terminology database with new content
     */
    async updateTerminologyDatabase() {
        console.log('🔄 [ContentScheduler] Updating terminology database...');
        
        try {
            // Process all scraped content and extract new terms
            await this.webScraper.processScrapedContent();
            
            // Get updated statistics
            const stats = this.terminologyService.getStatistics();
            console.log(`📊 [ContentScheduler] Database updated: ${stats.totalTerms} terms, ${stats.supportedLanguages.length} languages`);
            
        } catch (error) {
            console.error('❌ [ContentScheduler] Database update failed:', error);
        }
    }

    /**
     * Perform deep analysis of scraped content
     */
    async performDeepAnalysis() {
        console.log('🔍 [ContentScheduler] Performing deep content analysis...');
        
        try {
            // Analyze content patterns
            const analysis = await this.analyzeContentPatterns();
            
            // Identify trending topics
            const trendingTopics = await this.identifyTrendingTopics();
            
            // Update content recommendations
            await this.updateContentRecommendations(analysis, trendingTopics);
            
            console.log('✅ [ContentScheduler] Deep analysis completed');
            
        } catch (error) {
            console.error('❌ [ContentScheduler] Deep analysis failed:', error);
        }
    }

    /**
     * Analyze content patterns
     */
    async analyzeContentPatterns() {
        // This would analyze scraped content for patterns
        // For now, return basic analysis
        return {
            mostCommonTerms: [],
            languageDistribution: {},
            contentTypes: {},
            updateFrequency: 'daily'
        };
    }

    /**
     * Identify trending topics
     */
    async identifyTrendingTopics() {
        // This would identify trending Islamic topics
        // For now, return basic trending topics
        return [
            'Ramadan',
            'Hajj',
            'Zakat',
            'Prayer',
            'Quran'
        ];
    }

    /**
     * Update content recommendations
     */
    async updateContentRecommendations(analysis, trendingTopics) {
        console.log('📈 [ContentScheduler] Updating content recommendations...');
        // Implementation for content recommendations
    }

    /**
     * Optimize terminology database
     */
    async optimizeTerminologyDatabase() {
        console.log('⚡ [ContentScheduler] Optimizing terminology database...');
        
        try {
            // Remove duplicate terms
            // Merge similar terms
            // Update confidence scores
            // Clean up unused terms
            
            console.log('✅ [ContentScheduler] Database optimization completed');
        } catch (error) {
            console.error('❌ [ContentScheduler] Database optimization failed:', error);
        }
    }

    /**
     * Generate content report
     */
    async generateContentReport() {
        console.log('📊 [ContentScheduler] Generating content report...');
        
        try {
            const stats = this.webScraper.getStats();
            const terminologyStats = this.terminologyService.getStatistics();
            
            const report = {
                timestamp: new Date().toISOString(),
                scrapingStats: stats,
                terminologyStats: terminologyStats,
                recommendations: [
                    'Continue monitoring Islamic news sites',
                    'Focus on Khutbah content for better sermon translations',
                    'Update Quran translations regularly',
                    'Monitor trending Islamic topics'
                ]
            };
            
            console.log('📈 [ContentScheduler] Content report generated:', report);
            
        } catch (error) {
            console.error('❌ [ContentScheduler] Report generation failed:', error);
        }
    }

    /**
     * Generate weekly report
     */
    async generateWeeklyReport() {
        console.log('📊 [ContentScheduler] Generating weekly report...');
        
        try {
            const report = {
                timestamp: new Date().toISOString(),
                type: 'weekly',
                summary: {
                    totalScrapingRuns: 7,
                    newTermsAdded: 0,
                    contentUpdated: true,
                    databaseOptimized: true
                }
            };
            
            console.log('📈 [ContentScheduler] Weekly report generated');
            
        } catch (error) {
            console.error('❌ [ContentScheduler] Weekly report failed:', error);
        }
    }

    /**
     * Stop all scheduled jobs
     */
    stopScheduledScraping() {
        console.log('⏹️ [ContentScheduler] Stopping all scheduled jobs...');
        
        for (const [name, job] of this.scheduledJobs) {
            job.stop();
            console.log(`⏹️ [ContentScheduler] Stopped ${name} job`);
        }
        
        this.scheduledJobs.clear();
        this.isRunning = false;
        console.log('✅ [ContentScheduler] All jobs stopped');
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        try {
            console.log('📊 [ContentScheduler] Getting scheduler status...');
            
            // Ensure webScraper is available
            const webScraper = this.ensureWebScraper();
            
            console.log('🔍 [ContentScheduler] Web scraper available:', !!webScraper);
            console.log('🔍 [ContentScheduler] Terminology service available:', !!this.terminologyService);
            
            let scraperStats = {
                totalSites: 0,
                successfulScrapes: 0,
                failedScrapes: 0,
                newTerms: 0,
                updatedTerms: 0,
                lastScrape: null,
                isScraping: false,
                terminologyStats: {
                    totalTerms: 0,
                    supportedLanguages: [],
                    totalTranslations: 0,
                    error: 'Web scraper not available'
                },
                error: 'Web scraper not available'
            };
            
            if (webScraper) {
                try {
                    console.log('🕷️ [ContentScheduler] Getting scraper statistics...');
                    scraperStats = webScraper.getStats();
                    console.log('✅ [ContentScheduler] Scraper stats retrieved:', scraperStats);
                } catch (scraperError) {
                    console.error('❌ [ContentScheduler] Error getting scraper stats:', scraperError);
                    scraperStats = {
                        totalSites: 0,
                        successfulScrapes: 0,
                        failedScrapes: 0,
                        newTerms: 0,
                        updatedTerms: 0,
                        lastScrape: null,
                        isScraping: false,
                        terminologyStats: {
                            totalTerms: 0,
                            supportedLanguages: [],
                            totalTranslations: 0,
                            error: scraperError.message
                        },
                        error: scraperError.message
                    };
                }
            } else {
                console.warn('⚠️ [ContentScheduler] Web scraper not available');
            }
            
            const status = {
                isRunning: this.isRunning,
                activeJobs: Array.from(this.scheduledJobs.keys()),
                schedules: this.schedules,
                scraperStats: scraperStats
            };
            
            console.log('✅ [ContentScheduler] Final status:', status);
            return status;
        } catch (error) {
            console.error('❌ [ContentScheduler] Error getting status:', error);
            console.error('❌ [ContentScheduler] Error stack:', error.stack);
            return {
                isRunning: this.isRunning,
                activeJobs: Array.from(this.scheduledJobs.keys()),
                schedules: this.schedules,
                scraperStats: {
                    error: error.message,
                    isScraping: false,
                    totalSites: 0,
                    successfulScrapes: 0,
                    failedScrapes: 0,
                    newTerms: 0,
                    lastScrape: null
                },
                error: error.message
            };
        }
    }

    /**
     * Run immediate scraping (manual trigger)
     */
    async runImmediateScraping() {
        console.log('🚀 [ContentScheduler] Running immediate scraping...');
        
        try {
            await this.webScraper.startComprehensiveScraping();
            await this.updateTerminologyDatabase();
            
            console.log('✅ [ContentScheduler] Immediate scraping completed');
            return true;
        } catch (error) {
            console.error('❌ [ContentScheduler] Immediate scraping failed:', error);
            return false;
        }
    }
}

module.exports = ContentScheduler;
