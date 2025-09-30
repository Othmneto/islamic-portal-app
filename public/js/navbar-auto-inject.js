/**
 * Navbar Auto-Injection Script
 * Automatically adds the global navbar to all pages that don't have it
 */

class NavbarAutoInject {
    constructor() {
        this.navbarHTML = null;
        this.navbarCSS = null;
        this.navbarJS = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('🔧 [NavbarAutoInject] Initializing navbar auto-injection...');
        
        try {
            // Check if navbar already exists
            if (document.querySelector('.global-navbar')) {
                console.log('✅ [NavbarAutoInject] Navbar already exists, skipping injection');
                return;
            }

            // Load navbar components
            await this.loadNavbarComponents();
            
            // Inject navbar
            this.injectNavbar();
            
            // Load and initialize navbar functionality
            await this.loadNavbarFunctionality();
            
            this.isInitialized = true;
            console.log('✅ [NavbarAutoInject] Navbar auto-injection completed');
            
        } catch (error) {
            console.error('❌ [NavbarAutoInject] Error during initialization:', error);
        }
    }

    async loadNavbarComponents() {
        try {
            // Load navbar HTML
            const navbarResponse = await fetch('/components/global-navbar.html');
            if (navbarResponse.ok) {
                this.navbarHTML = await navbarResponse.text();
                console.log('📄 [NavbarAutoInject] Navbar HTML loaded');
            } else {
                throw new Error('Failed to load navbar HTML');
            }

            // Load navbar CSS
            const cssResponse = await fetch('/css/global-navbar.css');
            if (cssResponse.ok) {
                this.navbarCSS = await cssResponse.text();
                console.log('🎨 [NavbarAutoInject] Navbar CSS loaded');
            } else {
                console.warn('⚠️ [NavbarAutoInject] Failed to load navbar CSS');
            }

        } catch (error) {
            console.error('❌ [NavbarAutoInject] Error loading navbar components:', error);
            throw error;
        }
    }

    injectNavbar() {
        try {
            // Create navbar container
            const navbarContainer = document.createElement('div');
            navbarContainer.innerHTML = this.navbarHTML;
            
            // Insert navbar at the beginning of body
            const body = document.body;
            if (body.firstChild) {
                body.insertBefore(navbarContainer.firstElementChild, body.firstChild);
            } else {
                body.appendChild(navbarContainer.firstElementChild);
            }

            // Inject CSS if available
            if (this.navbarCSS) {
                const style = document.createElement('style');
                style.textContent = this.navbarCSS;
                document.head.appendChild(style);
            }

            console.log('✅ [NavbarAutoInject] Navbar injected successfully');
            
        } catch (error) {
            console.error('❌ [NavbarAutoInject] Error injecting navbar:', error);
        }
    }

    async loadNavbarFunctionality() {
        try {
            // Load navbar JavaScript
            const script = document.createElement('script');
            script.src = '/js/global-navbar.js';
            script.onload = () => {
                console.log('✅ [NavbarAutoInject] Navbar JavaScript loaded');
            };
            script.onerror = () => {
                console.error('❌ [NavbarAutoInject] Failed to load navbar JavaScript');
            };
            document.head.appendChild(script);

        } catch (error) {
            console.error('❌ [NavbarAutoInject] Error loading navbar functionality:', error);
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NavbarAutoInject();
    });
} else {
    new NavbarAutoInject();
}
