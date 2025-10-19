/**
 * Navbar Integration Script
 * Simple script to add global navbar to any page
 */

(function() {
    'use strict';

    // Check if navbar is already loaded
    if (document.querySelector('.global-navbar')) {
        console.log('🌐 [NavbarIntegration] Global navbar already exists');
        return;
    }

    // Load CSS
    function loadCSS() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/global-navbar.css';
        link.onload = () => console.log('📄 [NavbarIntegration] CSS loaded');
        link.onerror = () => console.warn('⚠️ [NavbarIntegration] Failed to load CSS');
        document.head.appendChild(link);
    }

    // Load JavaScript
    function loadJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/js/global-navbar.js';
            script.onload = () => {
                console.log('📄 [NavbarIntegration] JavaScript loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ [NavbarIntegration] Failed to load JavaScript');
                reject(new Error('Failed to load navbar JavaScript'));
            };
            document.head.appendChild(script);
        });
    }

    // Initialize navbar
    async function initNavbar() {
        try {
            // Load CSS first
            loadCSS();

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', async () => {
                    await loadJS();
                });
            } else {
                await loadJS();
            }

            console.log('✅ [NavbarIntegration] Global navbar integration complete');
        } catch (error) {
            console.error('❌ [NavbarIntegration] Failed to initialize navbar:', error);
        }
    }

    // Start initialization
    initNavbar();
})();
