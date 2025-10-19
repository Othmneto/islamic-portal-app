/**
 * Advanced Islamic Content Data Viewer
 * Comprehensive real-time interface for viewing scraped Islamic content and terminology
 */

class AdvancedDataViewer {
    constructor() {
        this.currentTab = 'terms';
        this.currentView = 'cards';
        this.terms = [];
        this.history = [];
        this.statistics = {};
        this.analytics = {};
        this.autoRefreshInterval = null;
        this.isAutoRefresh = false;
        this.refreshInterval = 10000; // 10 seconds
        this.itemsPerPage = 25;
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchQuery = '';
        this.filters = {
            language: '',
            category: '',
            date: '',
            sort: 'recent'
        };
        this.charts = {};
        this.notifications = [];
        this.settings = {
            enableSounds: true,
            enableAnimations: true,
            refreshInterval: 10000,
            itemsPerPage: 25
        };

        console.log('🔧 [AdvancedDataViewer] Initializing...');
        this.init();
    }

    async init() {
        try {
            console.log('🎯 [AdvancedDataViewer] Setting up UI elements...');
            this.setupElements();

            console.log('👂 [AdvancedDataViewer] Setting up event listeners...');
            this.setupEventListeners();

            console.log('⚙️ [AdvancedDataViewer] Loading settings...');
            this.loadSettings();

            console.log('📊 [AdvancedDataViewer] Loading initial data...');
            await this.loadOverviewData();
            await this.loadTerms();
            await this.loadAnalytics();
            await this.loadHistory();
            await this.loadStatistics();

            console.log('🎨 [AdvancedDataViewer] Initializing charts...');
            this.initializeCharts();

            console.log('🔄 [AdvancedDataViewer] Starting real-time updates...');
            this.startRealTimeUpdates();

            console.log('✅ [AdvancedDataViewer] Initialized successfully');
            this.showNotification('Data viewer initialized successfully', 'success');
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Initialization failed:', error);
            this.showError('Failed to initialize data viewer');
            this.showNotification('Failed to initialize data viewer', 'error');
        }
    }

    setupElements() {
        this.elements = {
            // Header elements
            refreshAll: document.getElementById('refresh-all'),
            exportAll: document.getElementById('export-all'),

            // Overview elements
            totalSites: document.getElementById('total-sites'),
            successfulScrapes: document.getElementById('successful-scrapes'),
            newTerms: document.getElementById('new-terms'),
            supportedLanguages: document.getElementById('supported-languages'),
            successRate: document.getElementById('success-rate'),
            lastScrape: document.getElementById('last-scrape'),

            // View controls
            viewToggles: document.querySelectorAll('.view-toggle'),
            cardsView: document.getElementById('cards-view'),
            chartsView: document.getElementById('charts-view'),

            // Tab elements
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),

            // Global search and filters
            globalSearch: document.getElementById('global-search'),
            clearSearch: document.getElementById('clear-search'),
            dateFilter: document.getElementById('date-filter'),
            categoryFilter: document.getElementById('category-filter'),

            // Terms tab elements
            termSearch: document.getElementById('term-search'),
            languageFilter: document.getElementById('language-filter'),
            sortFilter: document.getElementById('sort-filter'),
            termsList: document.getElementById('terms-list'),
            termsTotal: document.getElementById('terms-total'),
            termsPagination: document.getElementById('terms-pagination'),

            // Analytics tab elements
            analyticsTimeframe: document.getElementById('analytics-timeframe'),
            refreshAnalytics: document.getElementById('refresh-analytics'),

            // History tab elements
            historyFilter: document.getElementById('history-filter'),
            refreshHistory: document.getElementById('refresh-history'),
            historyList: document.getElementById('history-list'),

            // Statistics tab elements
            refreshStats: document.getElementById('refresh-stats'),
            statsContent: document.getElementById('stats-content'),

            // Export tab elements
            exportJson: document.getElementById('export-json'),
            exportCsv: document.getElementById('export-csv'),
            exportStatus: document.getElementById('export-status'),

            // Status bar elements
            lastUpdated: document.getElementById('last-updated'),
            scrapingStatus: document.getElementById('scraping-status'),
            dataPoints: document.getElementById('data-points'),
            recentActivity: document.getElementById('recent-activity'),
            autoRefresh: document.getElementById('auto-refresh'),
            notificationsToggle: document.getElementById('notifications-toggle'),
            settingsToggle: document.getElementById('settings-toggle'),

            // Modal elements
            settingsModal: document.getElementById('settings-modal'),
            modalClose: document.querySelector('.modal-close'),
            saveSettings: document.getElementById('save-settings'),
            resetSettings: document.getElementById('reset-settings'),

            // Notification container
            notificationContainer: document.getElementById('notification-container')
        };

        console.log('🎯 [AdvancedDataViewer] UI elements found:', Object.keys(this.elements).length);
    }

    setupEventListeners() {
        // Header controls
        this.elements.refreshAll?.addEventListener('click', () => {
            this.refreshAllData();
        });

        this.elements.exportAll?.addEventListener('click', () => {
            this.exportAllData();
        });

        // View toggles
        this.elements.viewToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Tab navigation
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Global search and filters
        this.elements.globalSearch?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.performGlobalSearch();
        });

        this.elements.clearSearch?.addEventListener('click', () => {
            this.clearSearch();
        });

        this.elements.dateFilter?.addEventListener('change', (e) => {
            this.filters.date = e.target.value;
            this.applyFilters();
        });

        this.elements.categoryFilter?.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.applyFilters();
        });

        // Terms search and filter
        this.elements.termSearch?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.filterTerms();
        });

        this.elements.languageFilter?.addEventListener('change', (e) => {
            this.filters.language = e.target.value;
            this.filterTerms();
        });

        this.elements.sortFilter?.addEventListener('change', (e) => {
            this.filters.sort = e.target.value;
            this.sortTerms();
        });

        // Analytics controls
        this.elements.analyticsTimeframe?.addEventListener('change', (e) => {
            this.loadAnalytics(e.target.value);
        });

        this.elements.refreshAnalytics?.addEventListener('click', () => {
            this.loadAnalytics();
        });

        // Research controls
        const researchCategory = document.getElementById('research-category');
        const refreshResearch = document.getElementById('refresh-research');

        researchCategory?.addEventListener('change', (e) => {
            this.loadResearchData(e.target.value);
        });

        refreshResearch?.addEventListener('click', () => {
            this.loadResearchData();
        });

        // Knowledge graph controls
        const graphFilter = document.getElementById('graph-filter');
        const refreshGraph = document.getElementById('refresh-graph');

        graphFilter?.addEventListener('change', (e) => {
            this.loadKnowledgeGraph(e.target.value);
        });

        refreshGraph?.addEventListener('click', () => {
            this.loadKnowledgeGraph();
        });

        // Cross-references controls
        const crossrefConfidence = document.getElementById('crossref-confidence');
        const refreshCrossref = document.getElementById('refresh-crossref');

        crossrefConfidence?.addEventListener('change', (e) => {
            this.loadCrossReferences(e.target.value);
        });

        refreshCrossref?.addEventListener('click', () => {
            this.loadCrossReferences();
        });

        // Start research button
        const startResearch = document.getElementById('start-research');
        startResearch?.addEventListener('click', () => {
            this.startResearch();
        });

        // History refresh
        this.elements.refreshHistory?.addEventListener('click', () => {
            this.loadHistory();
        });

        this.elements.historyFilter?.addEventListener('change', (e) => {
            this.filterHistory(e.target.value);
        });

        // Statistics refresh
        this.elements.refreshStats?.addEventListener('click', () => {
            this.loadStatistics();
        });

        // Export buttons
        this.elements.exportJson?.addEventListener('click', () => {
            this.exportData('json');
        });

        this.elements.exportCsv?.addEventListener('click', () => {
            this.exportData('csv');
        });

        // Status bar controls
        this.elements.autoRefresh?.addEventListener('click', () => {
            this.toggleAutoRefresh();
        });

        this.elements.notificationsToggle?.addEventListener('click', () => {
            this.toggleNotifications();
        });

        this.elements.settingsToggle?.addEventListener('click', () => {
            this.openSettings();
        });

        // Modal controls
        this.elements.modalClose?.addEventListener('click', () => {
            this.closeSettings();
        });

        this.elements.saveSettings?.addEventListener('click', () => {
            this.saveSettings();
        });

        this.elements.resetSettings?.addEventListener('click', () => {
            this.resetSettings();
        });

        // Close modal on outside click
        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });

        console.log('👂 [AdvancedDataViewer] Event listeners set up');
    }

    switchTab(tabName) {
        console.log('🔄 [AdvancedDataViewer] Switching to tab:', tabName);

        // Update tab buttons
        this.elements.tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        this.elements.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            }
        });

        this.currentTab = tabName;

        // Load data for the new tab if needed
        if (tabName === 'analytics' && !this.analytics.data) {
            this.loadAnalytics();
        } else if (tabName === 'research') {
            this.loadResearchData();
        } else if (tabName === 'knowledge-graph') {
            this.loadKnowledgeGraph();
        } else if (tabName === 'cross-references') {
            this.loadCrossReferences();
        }
    }

    switchView(viewName) {
        console.log('🔄 [AdvancedDataViewer] Switching to view:', viewName);

        // Update view toggles
        this.elements.viewToggles.forEach(toggle => {
            toggle.classList.remove('active');
            if (toggle.dataset.view === viewName) {
                toggle.classList.add('active');
            }
        });

        // Update view content
        if (viewName === 'cards') {
            this.elements.cardsView?.classList.add('active');
            this.elements.chartsView?.classList.remove('active');
        } else if (viewName === 'charts') {
            this.elements.cardsView?.classList.remove('active');
            this.elements.chartsView?.classList.add('active');
            this.updateCharts();
        }

        this.currentView = viewName;
    }

    // New advanced methods
    loadSettings() {
        const saved = localStorage.getItem('dataViewerSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
            this.refreshInterval = this.settings.refreshInterval;
            this.itemsPerPage = this.settings.itemsPerPage;
        }
    }

    saveSettings() {
        localStorage.setItem('dataViewerSettings', JSON.stringify(this.settings));
        this.showNotification('Settings saved successfully', 'success');
        this.closeSettings();
    }

    resetSettings() {
        this.settings = {
            enableSounds: true,
            enableAnimations: true,
            refreshInterval: 10000,
            itemsPerPage: 25
        };
        this.refreshInterval = this.settings.refreshInterval;
        this.itemsPerPage = this.settings.itemsPerPage;
        this.showNotification('Settings reset to default', 'info');
    }

    openSettings() {
        this.elements.settingsModal?.classList.add('active');
    }

    closeSettings() {
        this.elements.settingsModal?.classList.remove('active');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        this.elements.notificationContainer?.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    refreshAllData() {
        console.log('🔄 [AdvancedDataViewer] Refreshing all data...');
        this.showNotification('Refreshing all data...', 'info');

        Promise.all([
            this.loadOverviewData(),
            this.loadTerms(),
            this.loadAnalytics(),
            this.loadHistory(),
            this.loadStatistics()
        ]).then(() => {
            this.showNotification('All data refreshed successfully', 'success');
        }).catch(error => {
            console.error('❌ [AdvancedDataViewer] Refresh failed:', error);
            this.showNotification('Failed to refresh some data', 'error');
        });
    }

    exportAllData() {
        console.log('📤 [AdvancedDataViewer] Exporting all data...');
        this.showNotification('Preparing complete data export...', 'info');
        // Implementation for exporting all data
    }

    // Missing methods that are being called
    async loadAnalytics(timeframe = '24h') {
        try {
            console.log('📊 [AdvancedDataViewer] Loading analytics data...');

            // Mock analytics data for now
            this.analytics = {
                timeframe: timeframe,
                data: {
                    termDiscoveryRate: this.generateMockChartData(),
                    sitePerformance: this.generateMockChartData(),
                    languageUsage: this.generateMockChartData(),
                    efficiency: {
                        successRate: 95.2,
                        avgResponseTime: 1200,
                        termsPerHour: 45
                    }
                }
            };

            this.renderAnalytics();
            console.log('✅ [AdvancedDataViewer] Analytics loaded');
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Failed to load analytics:', error);
            this.showNotification('Failed to load analytics data', 'error');
        }
    }

    generateMockChartData() {
        return {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Activity',
                data: [12, 19, 3, 5, 2, 3],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        };
    }

    renderAnalytics() {
        if (!this.analytics.data) return;

        const { efficiency } = this.analytics.data;

        // Update efficiency metrics
        const efficiencySuccess = document.getElementById('efficiency-success');
        const efficiencyResponse = document.getElementById('efficiency-response');
        const efficiencyTerms = document.getElementById('efficiency-terms');

        if (efficiencySuccess) efficiencySuccess.textContent = `${efficiency.successRate}%`;
        if (efficiencyResponse) efficiencyResponse.textContent = `${efficiency.avgResponseTime}ms`;
        if (efficiencyTerms) efficiencyTerms.textContent = efficiency.termsPerHour;
    }

    initializeCharts() {
        console.log('🎨 [AdvancedDataViewer] Initializing charts...');

        // Initialize Chart.js charts
        this.initializeScrapingChart();
        this.initializeLanguageChart();
        this.initializeTermsTimelineChart();
    }

    initializeScrapingChart() {
        const ctx = document.getElementById('scraping-chart');
        if (!ctx) return;

        this.charts.scraping = new Chart(ctx, {
            type: 'line',
            data: this.generateMockChartData(),
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Scraping Activity Over Time'
                    }
                }
            }
        });
    }

    initializeLanguageChart() {
        const ctx = document.getElementById('language-chart');
        if (!ctx) return;

        this.charts.language = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Arabic', 'English', 'French', 'Spanish', 'Urdu', 'Others'],
                datasets: [{
                    data: [35, 25, 15, 10, 8, 7],
                    backgroundColor: [
                        '#667eea',
                        '#764ba2',
                        '#f093fb',
                        '#f5576c',
                        '#4facfe',
                        '#00f2fe'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Language Distribution'
                    }
                }
            }
        });
    }

    initializeTermsTimelineChart() {
        const ctx = document.getElementById('terms-timeline-chart');
        if (!ctx) return;

        this.charts.termsTimeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Terms Discovered',
                    data: [12, 19, 3, 5, 2, 3, 8],
                    backgroundColor: 'rgba(102, 126, 234, 0.8)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Term Discovery Timeline'
                    }
                }
            }
        });
    }

    updateCharts() {
        console.log('🔄 [AdvancedDataViewer] Updating charts...');
        // Update chart data if needed
    }

    startRealTimeUpdates() {
        console.log('🔄 [AdvancedDataViewer] Starting real-time updates...');

        // Start auto-refresh if enabled
        if (this.settings.autoRefresh !== false) {
            this.startAutoRefresh();
        }
    }

    performGlobalSearch() {
        console.log('🔍 [AdvancedDataViewer] Performing global search...');
        // Implementation for global search
    }

    clearSearch() {
        console.log('🧹 [AdvancedDataViewer] Clearing search...');
        this.searchQuery = '';
        this.elements.globalSearch.value = '';
        this.performGlobalSearch();
    }

    applyFilters() {
        console.log('🔍 [AdvancedDataViewer] Applying filters...');
        // Apply all active filters
        this.filterTerms();
    }

    filterTerms() {
        console.log('🔍 [AdvancedDataViewer] Filtering terms...');
        this.renderTerms();
    }

    sortTerms() {
        console.log('🔄 [AdvancedDataViewer] Sorting terms...');
        this.renderTerms();
    }

    filterHistory(filter) {
        console.log('🔍 [AdvancedDataViewer] Filtering history...');
        this.renderHistory();
    }

    toggleNotifications() {
        console.log('🔔 [AdvancedDataViewer] Toggling notifications...');
        this.showNotification('Notifications feature coming soon!', 'info');
    }

    async loadOverviewData() {
        try {
            console.log('📊 [AdvancedDataViewer] Loading research overview data...');

            const response = await fetch('/api/content-scraping/status');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 [AdvancedDataViewer] Research overview data received:', data);

            if (data.success && data.data) {
                const { scraper, terminology, researchData } = data.data;

                // Update basic stats
                if (this.elements.totalSites) this.elements.totalSites.textContent = scraper?.totalSites || 0;
                if (this.elements.successfulScrapes) this.elements.successfulScrapes.textContent = scraper?.successfulScrapes || 0;
                if (this.elements.newTerms) this.elements.newTerms.textContent = terminology?.totalTerms || 0;
                if (this.elements.supportedLanguages) this.elements.supportedLanguages.textContent = terminology?.supportedLanguages?.length || 0;

                // Update research-grade stats
                if (this.elements.totalSources) this.elements.totalSources.textContent = researchData?.totalSources || 0;
                if (this.elements.totalTerms) this.elements.totalTerms.textContent = researchData?.totalTerms || 0;
                if (this.elements.knowledgeNodes) this.elements.knowledgeNodes.textContent = researchData?.knowledgeNodes || 0;
                if (this.elements.crossReferences) this.elements.crossReferences.textContent = researchData?.crossReferences || 0;

                // Update enhanced stats
                if (this.elements.successRate) {
                    const successRate = scraper?.totalSites ? Math.round((scraper.successfulScrapes / (scraper.successfulScrapes + scraper.failedScrapes)) * 100) : 0;
                    this.elements.successRate.textContent = `${successRate}%`;
                }

                if (this.elements.lastScrape) {
                    const lastScrape = scraper?.lastScrape ? new Date(scraper.lastScrape).toLocaleString() : 'Never';
                    this.elements.lastScrape.textContent = lastScrape;
                }

                // Update data points
                if (this.elements.dataPoints) {
                    const dataPoints = (scraper?.successfulScrapes || 0) + (terminology?.totalTerms || 0);
                    this.elements.dataPoints.textContent = dataPoints.toLocaleString();
                }

                // Update scraping status
                const status = scraper?.isScraping ? 'running' : 'idle';
                if (this.elements.scrapingStatus) {
                    this.elements.scrapingStatus.textContent = status;
                    this.elements.scrapingStatus.className = `status-badge ${status}`;
                }

                // Update last updated time
                if (this.elements.lastUpdated) {
                    this.elements.lastUpdated.textContent = new Date().toLocaleTimeString();
                }

                // Update tab badges
                this.updateTabBadges(scraper, terminology, researchData);

                console.log('✅ [AdvancedDataViewer] Research overview data updated');
            } else {
                throw new Error(data.error || 'Failed to load research overview data');
            }
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Failed to load research overview data:', error);
            this.showError('Failed to load research overview data');
            this.showNotification('Failed to load research overview data', 'error');
        }
    }

    updateTabBadges(scraper, terminology, researchData) {
        // Update terms count badge
        const termsCount = document.getElementById('terms-count');
        if (termsCount) {
            termsCount.textContent = terminology?.totalTerms || 0;
        }

        // Update research count badge
        const researchCount = document.getElementById('research-count');
        if (researchCount) {
            researchCount.textContent = researchData?.totalSources || 0;
        }

        // Update knowledge graph count badge
        const graphCount = document.getElementById('graph-count');
        if (graphCount) {
            graphCount.textContent = researchData?.knowledgeNodes || 0;
        }

        // Update cross-references count badge
        const crossrefCount = document.getElementById('crossref-count');
        if (crossrefCount) {
            crossrefCount.textContent = researchData?.crossReferences || 0;
        }

        // Update analytics count badge
        const analyticsCount = document.getElementById('analytics-count');
        if (analyticsCount) {
            analyticsCount.textContent = scraper?.successfulScrapes || 0;
        }

        // Update history count badge
        const historyCount = document.getElementById('history-count');
        if (historyCount) {
            historyCount.textContent = scraper?.successfulScrapes || 0;
        }
    }

    // Research-Grade Methods
    async loadResearchData(category = '') {
        try {
            console.log('🔬 [AdvancedDataViewer] Loading research data...');

            const response = await fetch(`/api/content-scraping/research-data?category=${category}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🔬 [AdvancedDataViewer] Research data received:', data);

            if (data.success && data.data) {
                this.renderResearchData(data.data);
                console.log('✅ [AdvancedDataViewer] Research data loaded');
            } else {
                throw new Error(data.error || 'Failed to load research data');
            }
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Failed to load research data:', error);
            this.showNotification('Failed to load research data', 'error');
        }
    }

    renderResearchData(data) {
        // Update linguistic analysis
        const linguisticAnalysis = document.getElementById('linguistic-analysis');
        if (linguisticAnalysis && data.linguistic) {
            const { arabicScript, transliteration, classicalArabic, modernArabic } = data.linguistic;
            linguisticAnalysis.innerHTML = `
                <div class="metric">
                    <span class="metric-label">Arabic Script</span>
                    <span class="metric-value">${arabicScript || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Transliteration</span>
                    <span class="metric-value">${transliteration || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Classical Arabic</span>
                    <span class="metric-value">${classicalArabic || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Modern Arabic</span>
                    <span class="metric-value">${modernArabic || 0}</span>
                </div>
            `;
        }

        // Update cultural analysis
        const culturalAnalysis = document.getElementById('cultural-analysis');
        if (culturalAnalysis && data.cultural) {
            const { regionalReferences, culturalPractices, socialStructures } = data.cultural;
            culturalAnalysis.innerHTML = `
                <div class="metric">
                    <span class="metric-label">Regional References</span>
                    <span class="metric-value">${regionalReferences || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cultural Practices</span>
                    <span class="metric-value">${culturalPractices || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Social Structures</span>
                    <span class="metric-value">${socialStructures || 0}</span>
                </div>
            `;
        }

        // Update religious analysis
        const religiousAnalysis = document.getElementById('religious-analysis');
        if (religiousAnalysis && data.religious) {
            const { theologicalConcepts, legalConcepts, ethicalConcepts } = data.religious;
            religiousAnalysis.innerHTML = `
                <div class="metric">
                    <span class="metric-label">Theological Concepts</span>
                    <span class="metric-value">${theologicalConcepts || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Legal Concepts</span>
                    <span class="metric-value">${legalConcepts || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Ethical Concepts</span>
                    <span class="metric-value">${ethicalConcepts || 0}</span>
                </div>
            `;
        }

        // Update scholarly analysis
        const scholarlyAnalysis = document.getElementById('scholarly-analysis');
        if (scholarlyAnalysis && data.scholarly) {
            const { quranCitations, hadithCitations, scholarlyCitations } = data.scholarly;
            scholarlyAnalysis.innerHTML = `
                <div class="metric">
                    <span class="metric-label">Quran Citations</span>
                    <span class="metric-value">${quranCitations || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Hadith Citations</span>
                    <span class="metric-value">${hadithCitations || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Scholarly Citations</span>
                    <span class="metric-value">${scholarlyCitations || 0}</span>
                </div>
            `;
        }
    }

    async loadKnowledgeGraph(filter = '') {
        try {
            console.log('🧠 [AdvancedDataViewer] Loading knowledge graph...');

            const response = await fetch(`/api/content-scraping/knowledge-graph?filter=${filter}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🧠 [AdvancedDataViewer] Knowledge graph data received:', data);

            if (data.success && data.data) {
                this.renderKnowledgeGraph(data.data);
                console.log('✅ [AdvancedDataViewer] Knowledge graph loaded');
            } else {
                throw new Error(data.error || 'Failed to load knowledge graph');
            }
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Failed to load knowledge graph:', error);
            this.showNotification('Failed to load knowledge graph', 'error');
        }
    }

    renderKnowledgeGraph(data) {
        // Update graph stats
        const graphNodes = document.getElementById('graph-nodes');
        const graphEdges = document.getElementById('graph-edges');
        const graphClusters = document.getElementById('graph-clusters');

        if (graphNodes) graphNodes.textContent = data.nodes || 0;
        if (graphEdges) graphEdges.textContent = data.edges || 0;
        if (graphClusters) graphClusters.textContent = data.clusters || 0;

        // Update graph visualization placeholder
        const graphViz = document.getElementById('knowledge-graph-viz');
        if (graphViz) {
            graphViz.innerHTML = `
                <div class="graph-placeholder">
                    <i class="fas fa-project-diagram"></i>
                    <h3>Knowledge Graph Visualization</h3>
                    <p>Interactive network of Islamic concepts and relationships</p>
                    <div class="graph-stats">
                        <div class="stat-item">
                            <span class="stat-label">Nodes</span>
                            <span class="stat-value">${data.nodes || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Edges</span>
                            <span class="stat-value">${data.edges || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Clusters</span>
                            <span class="stat-value">${data.clusters || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async loadCrossReferences(confidence = '') {
        try {
            console.log('🔗 [AdvancedDataViewer] Loading cross-references...');

            const response = await fetch(`/api/content-scraping/cross-references?confidence=${confidence}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🔗 [AdvancedDataViewer] Cross-references data received:', data);

            if (data.success && data.data) {
                this.renderCrossReferences(data.data);
                console.log('✅ [AdvancedDataViewer] Cross-references loaded');
            } else {
                throw new Error(data.error || 'Failed to load cross-references');
            }
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Failed to load cross-references:', error);
            this.showNotification('Failed to load cross-references', 'error');
        }
    }

    renderCrossReferences(data) {
        const crossrefList = document.getElementById('crossref-list');
        if (!crossrefList) return;

        if (data.length === 0) {
            crossrefList.innerHTML = '<div class="loading">No cross-references found</div>';
            return;
        }

        crossrefList.innerHTML = data.map(item => `
            <div class="crossref-item">
                <div class="crossref-header">
                    <div class="crossref-sources">${item.sources || 'Unknown Sources'}</div>
                    <div class="crossref-confidence">${Math.round((item.confidence || 0) * 100)}%</div>
                </div>
                <div class="crossref-terms">
                    ${(item.commonTerms || []).map(term => `
                        <span class="crossref-term">${term}</span>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    async startResearch() {
        try {
            console.log('🚀 [AdvancedDataViewer] Starting research...');
            this.showNotification('Starting research-grade scraping...', 'info');

            const response = await fetch('/api/content-scraping/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🚀 [AdvancedDataViewer] Research started:', data);

            if (data.success) {
                this.showNotification('Research started successfully!', 'success');
                // Refresh overview data to show updated status
                await this.loadOverviewData();
            } else {
                throw new Error(data.error || 'Failed to start research');
            }
        } catch (error) {
            console.error('❌ [AdvancedDataViewer] Failed to start research:', error);
            this.showNotification('Failed to start research: ' + error.message, 'error');
        }
    }

    async loadTerms() {
        try {
            console.log('📚 [DataViewer] Loading Islamic terms...');

            const response = await fetch('/api/data-viewer/terms');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📚 [DataViewer] Terms data received:', data);

            if (data.success && data.data) {
                this.terms = data.data.terms || [];
                this.renderTerms();
                console.log('✅ [DataViewer] Terms loaded:', this.terms.length);
            } else {
                throw new Error(data.error || 'Failed to load terms');
            }
        } catch (error) {
            console.error('❌ [DataViewer] Failed to load terms:', error);
            this.elements.termsList.innerHTML = '<div class="loading">Failed to load terms</div>';
        }
    }

    renderTerms() {
        console.log('🎨 [AdvancedDataViewer] Rendering terms...');

        if (this.terms.length === 0) {
            this.elements.termsList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>No terms found</span></div>';
            return;
        }

        const searchTerm = this.searchQuery.toLowerCase();
        const languageFilter = this.filters.language;
        const categoryFilter = this.filters.category;

        let filteredTerms = this.terms.filter(term => {
            const matchesSearch = !searchTerm ||
                term.arabic.toLowerCase().includes(searchTerm) ||
                Object.values(term.translations).some(translation =>
                    translation.toLowerCase().includes(searchTerm)
                ) ||
                term.category.toLowerCase().includes(searchTerm);

            const matchesLanguage = !languageFilter ||
                term.translations[languageFilter];

            const matchesCategory = !categoryFilter ||
                term.category.toLowerCase() === categoryFilter.toLowerCase();

            return matchesSearch && matchesLanguage && matchesCategory;
        });

        // Sort terms
        filteredTerms = this.sortTermsArray(filteredTerms);

        // Update total count
        if (this.elements.termsTotal) {
            this.elements.termsTotal.textContent = filteredTerms.length;
        }

        // Calculate pagination
        this.totalPages = Math.ceil(filteredTerms.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedTerms = filteredTerms.slice(startIndex, endIndex);

        // Render terms
        this.elements.termsList.innerHTML = paginatedTerms.map(term => `
            <div class="term-item enhanced">
                <div class="term-header">
                    <div class="term-arabic">${term.arabic}</div>
                    <div class="term-category">${term.category}</div>
                    <div class="term-actions">
                        <button class="btn btn-sm" onclick="this.copyToClipboard('${term.arabic}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="term-translations">
                    ${Object.entries(term.translations).map(([lang, translation]) => `
                        <div class="translation-item">
                            <div class="translation-language">
                                <i class="fas fa-globe"></i>
                                ${this.getLanguageName(lang)}
                            </div>
                            <div class="translation-text">${translation}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="term-meta">
                    <span class="meta-item">
                        <i class="fas fa-clock"></i>
                        ${new Date().toLocaleDateString()}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-language"></i>
                        ${Object.keys(term.translations).length} languages
                    </span>
                </div>
            </div>
        `).join('');

        // Render pagination
        this.renderPagination();

        console.log('✅ [AdvancedDataViewer] Terms rendered:', paginatedTerms.length);
    }

    sortTermsArray(terms) {
        switch (this.filters.sort) {
            case 'alphabetical':
                return terms.sort((a, b) => a.arabic.localeCompare(b.arabic));
            case 'category':
                return terms.sort((a, b) => a.category.localeCompare(b.category));
            case 'popularity':
                return terms.sort((a, b) => Object.keys(b.translations).length - Object.keys(a.translations).length);
            case 'recent':
            default:
                return terms;
        }
    }

    renderPagination() {
        if (!this.elements.termsPagination) return;

        if (this.totalPages <= 1) {
            this.elements.termsPagination.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination">';

        // Previous button
        paginationHTML += `
            <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                    onclick="dataViewer.goToPage(${this.currentPage - 1})" 
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === 1 || i === this.totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `
                    <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="dataViewer.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn ${this.currentPage === this.totalPages ? 'disabled' : ''}" 
                    onclick="dataViewer.goToPage(${this.currentPage + 1})" 
                    ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += '</div>';
        this.elements.termsPagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.renderTerms();
    }

    filterTerms() {
        console.log('🔍 [DataViewer] Filtering terms...');
        this.renderTerms();
    }

    getLanguageName(code) {
        const languages = {
            'ar': 'Arabic',
            'en': 'English',
            'fr': 'French',
            'es': 'Spanish',
            'ur': 'Urdu',
            'hi': 'Hindi',
            'tr': 'Turkish',
            'fa': 'Persian',
            'ms': 'Malay',
            'id': 'Indonesian'
        };
        return languages[code] || code.toUpperCase();
    }

    async loadHistory() {
        try {
            console.log('📈 [DataViewer] Loading scraping history...');

            const response = await fetch('/api/data-viewer/history');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📈 [DataViewer] History data received:', data);

            if (data.success && data.data) {
                this.history = data.data.recentActivity || [];
                this.renderHistory();
                console.log('✅ [DataViewer] History loaded:', this.history.length);
            } else {
                throw new Error(data.error || 'Failed to load history');
            }
        } catch (error) {
            console.error('❌ [DataViewer] Failed to load history:', error);
            this.elements.historyList.innerHTML = '<div class="loading">Failed to load history</div>';
        }
    }

    renderHistory() {
        console.log('🎨 [DataViewer] Rendering history...');

        if (this.history.length === 0) {
            this.elements.historyList.innerHTML = '<div class="loading">No history found</div>';
            return;
        }

        this.elements.historyList.innerHTML = this.history.map(item => `
            <div class="history-item">
                <div class="history-header">
                    <div class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                    <div class="history-status">${item.type === 'term_discovery' ? 'Term Found' : 'Site Scraped'}</div>
                </div>
                <div class="history-details">
                    <strong>Action:</strong> ${item.action || 'Unknown'}<br>
                    <strong>Site:</strong> ${item.site || 'Unknown'}<br>
                    <strong>Type:</strong> ${item.type || 'Unknown'}
                </div>
            </div>
        `).join('');

        console.log('✅ [DataViewer] History rendered:', this.history.length);
    }

    async loadStatistics() {
        try {
            console.log('📊 [DataViewer] Loading detailed statistics...');

            const response = await fetch('/api/data-viewer/statistics');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 [DataViewer] Statistics data received:', data);

            if (data.success && data.data) {
                this.statistics = data.data;
                this.renderStatistics();
                console.log('✅ [DataViewer] Statistics loaded');
            } else {
                throw new Error(data.error || 'Failed to load statistics');
            }
        } catch (error) {
            console.error('❌ [DataViewer] Failed to load statistics:', error);
            this.elements.statsContent.innerHTML = '<div class="loading">Failed to load statistics</div>';
        }
    }

    renderStatistics() {
        console.log('🎨 [DataViewer] Rendering statistics...');

        const { terminology, scraping, performance } = this.statistics;

        this.elements.statsContent.innerHTML = `
            <div class="stats-grid">
                <div class="stats-card">
                    <h3>📚 Terminology Database</h3>
                    <div class="stats-item">
                        <span class="stats-label">Total Terms</span>
                        <span class="stats-value">${terminology?.totalTerms || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Languages</span>
                        <span class="stats-value">${terminology?.supportedLanguages?.length || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Total Translations</span>
                        <span class="stats-value">${terminology?.totalTranslations || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Avg Translations/Term</span>
                        <span class="stats-value">${terminology?.averageTranslationsPerTerm || '0'}</span>
                    </div>
                </div>
                
                <div class="stats-card">
                    <h3>🌐 Web Scraper</h3>
                    <div class="stats-item">
                        <span class="stats-label">Total Sites</span>
                        <span class="stats-value">${scraping?.totalSites || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Successful Scrapes</span>
                        <span class="stats-value">${scraping?.successfulScrapes || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Failed Scrapes</span>
                        <span class="stats-value">${scraping?.failedScrapes || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Success Rate</span>
                        <span class="stats-value">${scraping?.successRate || '0'}%</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">New Terms Found</span>
                        <span class="stats-value">${scraping?.newTerms || 0}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Status</span>
                        <span class="stats-value">${scraping?.isScraping ? 'Running' : 'Idle'}</span>
                    </div>
                </div>
                
                <div class="stats-card">
                    <h3>⚡ System Performance</h3>
                    <div class="stats-item">
                        <span class="stats-label">Uptime</span>
                        <span class="stats-value">${Math.floor((performance?.uptime || 0) / 3600)}h</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Memory Usage</span>
                        <span class="stats-value">${Math.round((performance?.memoryUsage?.heapUsed || 0) / 1024 / 1024)}MB</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Node Version</span>
                        <span class="stats-value">${performance?.nodeVersion || 'Unknown'}</span>
                    </div>
                    <div class="stats-item">
                        <span class="stats-label">Platform</span>
                        <span class="stats-value">${performance?.platform || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        `;

        console.log('✅ [DataViewer] Statistics rendered');
    }

    async exportData(format) {
        try {
            console.log(`📤 [DataViewer] Exporting data as ${format.toUpperCase()}...`);

            this.elements.exportStatus.innerHTML = '<div class="loading">Preparing export...</div>';

            const response = await fetch(`/api/data-viewer/export?format=${format}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `islamic-content-data.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.elements.exportStatus.innerHTML = `
                <div class="export-status success">
                    ✅ Export completed successfully! File downloaded.
                </div>
            `;

            console.log('✅ [DataViewer] Export completed');
        } catch (error) {
            console.error('❌ [DataViewer] Export failed:', error);
            this.elements.exportStatus.innerHTML = `
                <div class="export-status error">
                    ❌ Export failed: ${error.message}
                </div>
            `;
        }
    }

    toggleAutoRefresh() {
        if (this.isAutoRefresh) {
            this.stopAutoRefresh();
        } else {
            this.startAutoRefresh();
        }
    }

    startAutoRefresh() {
        console.log('🔄 [AdvancedDataViewer] Starting auto refresh...');
        this.isAutoRefresh = true;
        this.elements.autoRefresh.innerHTML = '<i class="fas fa-stop"></i> Stop Auto Refresh';
        this.elements.autoRefresh.classList.add('btn-danger');

        this.autoRefreshInterval = setInterval(async () => {
            try {
                await this.loadOverviewData();
                if (this.currentTab === 'terms') await this.loadTerms();
                if (this.currentTab === 'analytics') await this.loadAnalytics();
                if (this.currentTab === 'history') await this.loadHistory();
                if (this.currentTab === 'statistics') await this.loadStatistics();

                // Update recent activity
                this.updateRecentActivity();
            } catch (error) {
                console.error('❌ [AdvancedDataViewer] Auto refresh error:', error);
            }
        }, this.refreshInterval);

        console.log('✅ [AdvancedDataViewer] Auto refresh started');
        this.showNotification('Auto refresh started', 'success');
    }

    stopAutoRefresh() {
        console.log('⏹️ [AdvancedDataViewer] Stopping auto refresh...');
        this.isAutoRefresh = false;
        this.elements.autoRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Auto Refresh';
        this.elements.autoRefresh.classList.remove('btn-danger');

        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }

        console.log('✅ [AdvancedDataViewer] Auto refresh stopped');
        this.showNotification('Auto refresh stopped', 'info');
    }

    updateRecentActivity() {
        const activities = [
            'New Islamic term discovered: الصلاة',
            'Site scraped successfully: Quran.com',
            'Translation updated: الزكاة',
            'Analytics data refreshed',
            'Database statistics updated'
        ];

        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        if (this.elements.recentActivity) {
            this.elements.recentActivity.textContent = randomActivity;
        }
    }

    showError(message) {
        console.error('❌ [DataViewer] Error:', message);
        // You could add a toast notification or error display here
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 [AdvancedDataViewer] DOM loaded, initializing...');
    window.dataViewer = new AdvancedDataViewer();
});
