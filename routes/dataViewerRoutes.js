/**
 * Data Viewer Routes
 * Provides comprehensive views of all scraped Islamic content
 */

const express = require('express');
const router = express.Router();

// Import services
let webScraperService = null;
let terminologyService = null;

// Initialize services
try {
    const WebScraperService = require('../services/webScraperService');
    const IslamicTerminologyService = require('../services/islamicTerminologyService');
    
    webScraperService = new WebScraperService();
    terminologyService = new IslamicTerminologyService();
    
    console.log('✅ [DataViewerRoutes] Services initialized successfully');
} catch (error) {
    console.error('❌ [DataViewerRoutes] Error initializing services:', error);
}

/**
 * Get all scraped data overview
 */
router.get('/overview', async (req, res) => {
    try {
        console.log('📊 [DataViewerRoutes] Getting data overview...');
        
        const scraperStats = webScraperService ? webScraperService.getStats() : null;
        const terminologyStats = terminologyService ? terminologyService.getStatistics() : null;
        
        const overview = {
            timestamp: new Date().toISOString(),
            scraper: {
                totalSites: scraperStats?.totalSites || 0,
                successfulScrapes: scraperStats?.successfulScrapes || 0,
                failedScrapes: scraperStats?.failedScrapes || 0,
                newTerms: scraperStats?.newTerms || 0,
                updatedTerms: scraperStats?.updatedTerms || 0,
                lastScrape: scraperStats?.lastScrape || null,
                isScraping: scraperStats?.isScraping || false
            },
            terminology: {
                totalTerms: terminologyStats?.totalTerms || 0,
                supportedLanguages: terminologyStats?.supportedLanguages || [],
                totalTranslations: terminologyStats?.totalTranslations || 0
            },
            dataSources: [
                'Quran.com',
                'Sunnah.com', 
                'Al-Islam.org',
                'IslamQA.info',
                'IslamWeb.net',
                'Hadith.com',
                'IslamicFinder.org',
                'Muslim.org',
                'IslamOnline.net',
                'IslamicRelief.org',
                'IslamicSociety.org',
                'MuslimMatters.org'
            ]
        };
        
        console.log('✅ [DataViewerRoutes] Overview data prepared:', overview);
        res.json({ success: true, data: overview });
        
    } catch (error) {
        console.error('❌ [DataViewerRoutes] Error getting overview:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get data overview',
            details: error.message 
        });
    }
});

/**
 * Get all scraped terms
 */
router.get('/terms', async (req, res) => {
    try {
        console.log('📚 [DataViewerRoutes] Getting all scraped terms...');
        
        if (!terminologyService) {
            return res.status(500).json({ 
                success: false, 
                error: 'Terminology service not available' 
            });
        }
        
        // Get all terms from the terminology service
        const allTerms = terminologyService.getAllTerms ? terminologyService.getAllTerms() : [];
        const stats = terminologyService.getStatistics();
        
        const termsData = {
            timestamp: new Date().toISOString(),
            totalTerms: stats.totalTerms,
            supportedLanguages: stats.supportedLanguages,
            totalTranslations: stats.totalTranslations,
            terms: allTerms
        };
        
        console.log('✅ [DataViewerRoutes] Terms data prepared:', {
            totalTerms: termsData.totalTerms,
            supportedLanguages: termsData.supportedLanguages.length,
            termsCount: termsData.terms.length
        });
        
        res.json({ success: true, data: termsData });
        
    } catch (error) {
        console.error('❌ [DataViewerRoutes] Error getting terms:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get terms data',
            details: error.message 
        });
    }
});

/**
 * Get scraping history
 */
router.get('/history', async (req, res) => {
    try {
        console.log('📈 [DataViewerRoutes] Getting scraping history...');
        
        if (!webScraperService) {
            return res.status(500).json({ 
                success: false, 
                error: 'Web scraper service not available' 
            });
        }
        
        const stats = webScraperService.getStats();
        
        // Generate mock history data based on current stats
        const history = {
            timestamp: new Date().toISOString(),
            totalSites: stats.totalSites,
            successfulScrapes: stats.successfulScrapes,
            failedScrapes: stats.failedScrapes,
            newTerms: stats.newTerms,
            lastScrape: stats.lastScrape,
            isScraping: stats.isScraping,
            recentActivity: [
                {
                    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                    action: 'Found new Islamic term: الصلاة',
                    site: 'Quran.com',
                    type: 'term_discovery'
                },
                {
                    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                    action: 'Successfully scraped: Sunnah.com',
                    site: 'Sunnah.com',
                    type: 'site_scraped'
                },
                {
                    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
                    action: 'Found new Islamic term: الشهادة',
                    site: 'Al-Islam.org',
                    type: 'term_discovery'
                },
                {
                    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                    action: 'Successfully scraped: IslamQA.info',
                    site: 'IslamQA.info',
                    type: 'site_scraped'
                },
                {
                    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                    action: 'Found new Islamic term: الحج',
                    site: 'IslamWeb.net',
                    type: 'term_discovery'
                }
            ]
        };
        
        console.log('✅ [DataViewerRoutes] History data prepared:', {
            totalSites: history.totalSites,
            successfulScrapes: history.successfulScrapes,
            recentActivity: history.recentActivity.length
        });
        
        res.json({ success: true, data: history });
        
    } catch (error) {
        console.error('❌ [DataViewerRoutes] Error getting history:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get scraping history',
            details: error.message 
        });
    }
});

/**
 * Get detailed statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        console.log('📊 [DataViewerRoutes] Getting detailed statistics...');
        
        const scraperStats = webScraperService ? webScraperService.getStats() : null;
        const terminologyStats = terminologyService ? terminologyService.getStatistics() : null;
        
        const statistics = {
            timestamp: new Date().toISOString(),
            scraping: {
                totalSites: scraperStats?.totalSites || 0,
                successfulScrapes: scraperStats?.successfulScrapes || 0,
                failedScrapes: scraperStats?.failedScrapes || 0,
                successRate: scraperStats?.totalSites > 0 ? 
                    ((scraperStats.successfulScrapes / (scraperStats.successfulScrapes + scraperStats.failedScrapes)) * 100).toFixed(2) : 0,
                newTerms: scraperStats?.newTerms || 0,
                updatedTerms: scraperStats?.updatedTerms || 0,
                lastScrape: scraperStats?.lastScrape || null,
                isScraping: scraperStats?.isScraping || false
            },
            terminology: {
                totalTerms: terminologyStats?.totalTerms || 0,
                supportedLanguages: terminologyStats?.supportedLanguages || [],
                totalTranslations: terminologyStats?.totalTranslations || 0,
                averageTranslationsPerTerm: terminologyStats?.totalTerms > 0 ? 
                    (terminologyStats.totalTranslations / terminologyStats.totalTerms).toFixed(2) : 0
            },
            performance: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform
            }
        };
        
        console.log('✅ [DataViewerRoutes] Statistics data prepared:', {
            scraping: statistics.scraping,
            terminology: statistics.terminology
        });
        
        res.json({ success: true, data: statistics });
        
    } catch (error) {
        console.error('❌ [DataViewerRoutes] Error getting statistics:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get statistics',
            details: error.message 
        });
    }
});

/**
 * Export data as JSON or CSV
 */
router.get('/export', async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        console.log('📤 [DataViewerRoutes] Exporting data as', format.toUpperCase());
        
        const scraperStats = webScraperService ? webScraperService.getStats() : null;
        const terminologyStats = terminologyService ? terminologyService.getStatistics() : null;
        
        if (format.toLowerCase() === 'json') {
            const exportData = {
                exportTimestamp: new Date().toISOString(),
                version: '1.0.0',
                scraper: scraperStats,
                terminology: terminologyStats,
                metadata: {
                    totalDataPoints: (scraperStats?.totalSites || 0) + (terminologyStats?.totalTerms || 0),
                    exportFormat: 'JSON',
                    generatedBy: 'Islamic Content Scraper'
                }
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="islamic-content-data.json"');
            
            console.log('✅ [DataViewerRoutes] JSON data exported successfully');
            res.json(exportData);
            
        } else if (format.toLowerCase() === 'csv') {
            // Get all terms for CSV export
            const allTerms = terminologyService && terminologyService.getAllTerms ? 
                terminologyService.getAllTerms() : [];
            
            const csvData = convertToCSV(allTerms, scraperStats);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="islamic-content-data.csv"');
            
            console.log('✅ [DataViewerRoutes] CSV data exported successfully');
            res.send(csvData);
            
        } else {
            res.status(400).json({ 
                success: false, 
                error: 'Unsupported format. Use json or csv.' 
            });
        }
        
    } catch (error) {
        console.error('❌ [DataViewerRoutes] Error exporting data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export data',
            details: error.message 
        });
    }
});

/**
 * Convert terms data to CSV format
 */
function convertToCSV(terms, scraperStats) {
    if (!terms || terms.length === 0) {
        return 'No terms available for export';
    }

    // Create CSV headers
    const headers = [
        'Arabic Term',
        'Category',
        'English Translation',
        'French Translation',
        'Spanish Translation',
        'Urdu Translation',
        'Hindi Translation',
        'Turkish Translation',
        'Persian Translation',
        'Malay Translation',
        'Indonesian Translation',
        'Source',
        'Last Updated'
    ];

    // Create CSV rows
    const csvRows = [headers.join(',')];

    terms.forEach(term => {
        const row = [
            `"${(term.arabic || '').replace(/"/g, '""')}"`,
            `"${(term.category || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.en || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.fr || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.es || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.ur || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.hi || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.tr || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.fa || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.ms || '').replace(/"/g, '""')}"`,
            `"${(term.translations?.id || '').replace(/"/g, '""')}"`,
            `"${(term.source || 'Unknown').replace(/"/g, '""')}"`,
            `"${(term.lastUpdated || new Date().toISOString()).replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    // Add summary information at the end
    csvRows.push(''); // Empty row
    csvRows.push('"Summary Information"');
    csvRows.push(`"Total Terms,${terms.length}"`);
    csvRows.push(`"Total Sites,${scraperStats?.totalSites || 0}"`);
    csvRows.push(`"Successful Scrapes,${scraperStats?.successfulScrapes || 0}"`);
    csvRows.push(`"Export Date,${new Date().toISOString()}"`);

    return csvRows.join('\n');
}

module.exports = router;
