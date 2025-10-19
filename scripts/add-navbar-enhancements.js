/**
 * Script to add navbar enhancements to all HTML pages
 */

const fs = require('fs');
const path = require('path');

// List of pages to update
const pagesToUpdate = [
    'index.html',
    'translator/text-translator.html',
    'prayer-time.html',
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

// Enhancement script addition
const enhancementScript = `    <script src="/js/navbar-enhancements.js"></script>`;

/**
 * Add enhancements to a page
 */
function addEnhancementsToPage(pageName) {
    const filePath = path.join(__dirname, '..', 'public', pageName);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${pageName}`);
        return false;
    }

    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Check if enhancements already exist
        if (content.includes('navbar-enhancements.js')) {
            console.log(`⏭️  Enhancements already exist in: ${pageName}`);
            return true;
        }

        // Add enhancement script before closing body tag
        if (content.includes('</body>')) {
            content = content.replace(
                /(.*)(<\/body>)/,
                `$1\n${enhancementScript}\n$2`
            );
        }

        // Write the updated content
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Added enhancements to: ${pageName}`);
        return true;

    } catch (error) {
        console.error(`❌ Error updating ${pageName}:`, error.message);
        return false;
    }
}

// Main execution
console.log('🚀 Adding navbar enhancements to all pages...\n');

let successCount = 0;
let totalCount = pagesToUpdate.length;

pagesToUpdate.forEach(pageName => {
    if (addEnhancementsToPage(pageName)) {
        successCount++;
    }
});

console.log(`\n🎉 Completed! Successfully updated ${successCount}/${totalCount} pages.`);

if (successCount === totalCount) {
    console.log('✅ All pages now have navbar enhancements!');
} else {
    console.log('⚠️  Some pages may need manual updates.');
}
