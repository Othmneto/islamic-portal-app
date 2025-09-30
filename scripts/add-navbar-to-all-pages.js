/**
 * Script to add global navbar to all HTML pages in the project
 */

const fs = require('fs');
const path = require('path');

// List of pages to update (excluding already updated ones)
const pagesToUpdate = [
  'qibla.html',
  'moon.html',
  'explorer.html',
  'duas.html',
  'names.html',
  'zakat.html',
  'converter.html',
  'calendar.html',
  'analytics.html',
  'history.html',
  'profile.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'reset-password.html',
  'verify-email.html',
  'setup-username.html',
  'security-dashboard.html',
  'translator.html',
  'live-voice-translator.html',
  'test-translator.html',
  'setup-notifications.html',
  'test-debug.html',
  'khutbah.html',
  'authCallback.html',
  'stats.html',
  'widget.html'
];

// Navbar HTML template
const navbarHTML = `  <!-- Global Navbar -->
  <header class="global-navbar">
    <nav class="navbar-container">
      <!-- Logo Section -->
      <div class="navbar-brand">
        <a href="/" class="brand-logo">
          <i class="fas fa-mosque brand-icon"></i>
          <span class="brand-text">Islamic Portal</span>
        </a>
      </div>

      <!-- Main Navigation -->
      <div class="navbar-nav">
        <ul class="nav-menu">
          <!-- Core Features -->
          <li class="nav-item">
            <a href="/translator/text-translator" class="nav-link" data-tooltip="AI-Powered Translation">
              <i class="fas fa-language"></i>
              <span class="nav-text">Translator</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="/prayer-time.html" class="nav-link" data-tooltip="Prayer Times & Qibla">
              <i class="fas fa-mosque"></i>
              <span class="nav-text">Prayer Times</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="/qibla.html" class="nav-link" data-tooltip="Qibla Direction">
              <i class="fas fa-compass"></i>
              <span class="nav-text">Qibla</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="/moon.html" class="nav-link" data-tooltip="Moon Status">
              <i class="fas fa-moon"></i>
              <span class="nav-text">Moon</span>
            </a>
          </li>

          <!-- Islamic Content -->
          <li class="nav-item dropdown">
            <a href="#" class="nav-link dropdown-toggle" data-tooltip="Islamic Content">
              <i class="fas fa-book-open"></i>
              <span class="nav-text">Content</span>
              <i class="fas fa-chevron-down dropdown-arrow"></i>
            </a>
            <ul class="dropdown-menu">
              <li><a href="/explorer.html" class="dropdown-link">
                <i class="fas fa-search"></i> Quran Explorer
              </a></li>
              <li><a href="/duas.html" class="dropdown-link">
                <i class="fas fa-hands-praying"></i> Daily Duas
              </a></li>
              <li><a href="/names.html" class="dropdown-link">
                <i class="fas fa-star"></i> 99 Names
              </a></li>
            </ul>
          </li>

          <!-- Tools -->
          <li class="nav-item dropdown">
            <a href="#" class="nav-link dropdown-toggle" data-tooltip="Islamic Tools">
              <i class="fas fa-tools"></i>
              <span class="nav-text">Tools</span>
              <i class="fas fa-chevron-down dropdown-arrow"></i>
            </a>
            <ul class="dropdown-menu">
              <li><a href="/zakat.html" class="dropdown-link">
                <i class="fas fa-coins"></i> Zakat Calculator
              </a></li>
              <li><a href="/converter.html" class="dropdown-link">
                <i class="fas fa-calendar-alt"></i> Date Converter
              </a></li>
              <li><a href="/calendar.html" class="dropdown-link">
                <i class="fas fa-calendar"></i> Islamic Calendar
              </a></li>
            </ul>
          </li>

          <!-- Analytics & History -->
          <li class="nav-item">
            <a href="/analytics.html" class="nav-link" data-tooltip="Analytics Dashboard">
              <i class="fas fa-chart-line"></i>
              <span class="nav-text">Analytics</span>
            </a>
          </li>
          <li class="nav-item">
            <a href="/history.html" class="nav-link" data-tooltip="Translation History">
              <i class="fas fa-history"></i>
              <span class="nav-text">History</span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Right Side Controls -->
      <div class="navbar-controls">
        <!-- Search -->
        <div class="search-container">
          <button class="search-toggle" id="search-toggle" data-tooltip="Search">
            <i class="fas fa-search"></i>
          </button>
          <div class="search-dropdown" id="search-dropdown">
            <input type="text" placeholder="Search..." class="search-input" id="global-search">
            <div class="search-results" id="search-results"></div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="notification-container">
          <button class="notification-toggle" id="notification-toggle" data-tooltip="Notifications">
            <i class="fas fa-bell"></i>
            <span class="notification-badge" id="notification-badge">0</span>
          </button>
          <div class="notification-dropdown" id="notification-dropdown">
            <div class="notification-header">
              <h4>Notifications</h4>
              <button class="mark-all-read" id="mark-all-read">Mark all read</button>
            </div>
            <div class="notification-list" id="notification-list">
              <div class="notification-empty">No new notifications</div>
            </div>
          </div>
        </div>

        <!-- User Menu -->
        <div class="user-menu-container">
          <button class="user-toggle" id="user-toggle" data-tooltip="User Menu">
            <div class="user-avatar" id="user-avatar">
              <i class="fas fa-user"></i>
            </div>
            <span class="user-name" id="user-name">Guest</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <div class="user-info">
              <div class="user-avatar-large" id="user-avatar-large">
                <i class="fas fa-user"></i>
              </div>
              <div class="user-details">
                <div class="user-name-large" id="user-name-large">Guest User</div>
                <div class="user-email" id="user-email">guest@example.com</div>
              </div>
            </div>
            <div class="user-menu-divider"></div>
            <ul class="user-menu-list">
              <li><a href="/profile.html" class="user-menu-link">
                <i class="fas fa-user"></i> Profile
              </a></li>
              <li><a href="/settings.html" class="user-menu-link">
                <i class="fas fa-cog"></i> Settings
              </a></li>
              <li><a href="/security-dashboard.html" class="user-menu-link">
                <i class="fas fa-shield-alt"></i> Security
              </a></li>
              <li class="user-menu-divider"></li>
              <li><a href="/login.html" class="user-menu-link" id="login-link">
                <i class="fas fa-sign-in-alt"></i> Login
              </a></li>
              <li><a href="#" class="user-menu-link" id="logout-link" style="display: none;">
                <i class="fas fa-sign-out-alt"></i> Logout
              </a></li>
            </ul>
          </div>
        </div>

        <!-- Theme Toggle -->
        <div class="theme-toggle-container">
          <button class="theme-toggle" id="theme-toggle" data-tooltip="Toggle Theme">
            <i class="fas fa-sun theme-icon-light"></i>
            <i class="fas fa-moon theme-icon-dark"></i>
          </button>
        </div>

        <!-- Mobile Menu Toggle -->
        <button class="mobile-menu-toggle" id="mobile-menu-toggle">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
      </div>
    </nav>

    <!-- Mobile Navigation Overlay -->
    <div class="mobile-nav-overlay" id="mobile-nav-overlay">
      <div class="mobile-nav-content">
        <div class="mobile-nav-header">
          <div class="mobile-nav-brand">
            <i class="fas fa-mosque"></i>
            <span>Islamic Portal</span>
          </div>
          <button class="mobile-nav-close" id="mobile-nav-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="mobile-nav-body">
          <!-- Mobile navigation will be populated by JavaScript -->
        </div>
      </div>
    </div>
  </header>`;

// CSS and JavaScript additions
const cssAddition = `  <!-- Include global navbar CSS -->
  <link rel="stylesheet" href="/css/global-navbar.css">
  
  <style>
    /* Add top padding to account for fixed navbar */
    .page-content {
      padding-top: 70px; /* Height of navbar */
    }
  </style>`;

const jsAddition = `  <!-- Global Navbar JavaScript -->
  <script src="/js/global-navbar.js"></script>
  
  <script>
    // Initialize navbar when page loads
    document.addEventListener('DOMContentLoaded', () => {
      if (window.GlobalNavbar) {
        window.globalNavbar = new window.GlobalNavbar();
      }
    });
  </script>`;

// Function to add navbar to a page
function addNavbarToPage(pageName) {
  const filePath = path.join(__dirname, '..', 'public', pageName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${pageName}`);
    return false;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if navbar already exists
    if (content.includes('global-navbar')) {
      console.log(`⏭️  Navbar already exists in: ${pageName}`);
      return true;
    }
    
    // Determine the active page for highlighting
    let activeClass = '';
    if (pageName.includes('qibla')) activeClass = 'qibla';
    else if (pageName.includes('moon')) activeClass = 'moon';
    else if (pageName.includes('explorer')) activeClass = 'explorer';
    else if (pageName.includes('duas')) activeClass = 'duas';
    else if (pageName.includes('names')) activeClass = 'names';
    else if (pageName.includes('zakat')) activeClass = 'zakat';
    else if (pageName.includes('converter')) activeClass = 'converter';
    else if (pageName.includes('calendar')) activeClass = 'calendar';
    else if (pageName.includes('analytics')) activeClass = 'analytics';
    else if (pageName.includes('history')) activeClass = 'history';
    else if (pageName.includes('profile')) activeClass = 'profile';
    else if (pageName.includes('login')) activeClass = 'login';
    else if (pageName.includes('register')) activeClass = 'register';
    else if (pageName.includes('security-dashboard')) activeClass = 'security';
    
    // Create navbar with active class
    let navbarWithActive = navbarHTML;
    if (activeClass) {
      // Add active class to the appropriate nav link
      const activeMap = {
        'qibla': 'Qibla Direction',
        'moon': 'Moon Status',
        'explorer': 'Quran Explorer',
        'duas': 'Daily Duas',
        'names': '99 Names',
        'zakat': 'Zakat Calculator',
        'converter': 'Date Converter',
        'calendar': 'Islamic Calendar',
        'analytics': 'Analytics Dashboard',
        'history': 'Translation History',
        'profile': 'Profile',
        'login': 'Login',
        'register': 'Register',
        'security': 'Security'
      };
      
      const activeText = activeMap[activeClass];
      if (activeText) {
        navbarWithActive = navbarWithActive.replace(
          new RegExp(`data-tooltip="${activeText}"`),
          `data-tooltip="${activeText}" class="nav-link active"`
        );
      }
    }
    
    // Add CSS to head
    if (content.includes('<head>')) {
      content = content.replace(
        /(<head>[\s\S]*?)(<\/head>)/,
        `$1${cssAddition}\n$2`
      );
    }
    
    // Add navbar after body tag
    if (content.includes('<body>')) {
      content = content.replace(
        /(<body[^>]*>)/,
        `$1\n${navbarWithActive}\n`
      );
    }
    
    // Wrap main content in page-content div
    if (content.includes('<body>') && !content.includes('page-content')) {
      // Find the first content after body and navbar
      const bodyMatch = content.match(/<body[^>]*>[\s\S]*?<\/header>([\s\S]*?)(<script|<\/body>)/);
      if (bodyMatch) {
        const beforeContent = bodyMatch[1];
        const afterContent = bodyMatch[2];
        const wrappedContent = `<div class="page-content">${beforeContent}</div>${afterContent}`;
        content = content.replace(bodyMatch[0], content.match(/<body[^>]*>[\s\S]*?<\/header>/)[0] + wrappedContent);
      }
    }
    
    // Add JavaScript before closing body tag
    if (content.includes('</body>')) {
      content = content.replace(
        /(.*)(<\/body>)/,
        `$1\n${jsAddition}\n$2`
      );
    }
    
    // Write the updated content
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Added navbar to: ${pageName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error updating ${pageName}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🚀 Starting navbar addition to all pages...\n');

let successCount = 0;
let totalCount = pagesToUpdate.length;

pagesToUpdate.forEach(pageName => {
  if (addNavbarToPage(pageName)) {
    successCount++;
  }
});

console.log(`\n🎉 Completed! Successfully updated ${successCount}/${totalCount} pages.`);

if (successCount === totalCount) {
  console.log('✅ All pages now have the global navbar!');
} else {
  console.log('⚠️  Some pages may need manual updates.');
}
