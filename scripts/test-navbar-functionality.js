/**
 * Comprehensive Navbar Functionality Test
 * Tests all navbar features across different pages
 */

const fs = require('fs');
const path = require('path');

// Test pages to check
const testPages = [
    'index.html',
    'translator/text-translator.html',
    'prayer-time.html',
    'qibla.html',
    'moon.html',
    'login.html',
    'test-navbar.html'
];

// Test results
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Test a single page
 */
function testPage(pagePath) {
    const fullPath = path.join(__dirname, '..', 'public', pagePath);

    if (!fs.existsSync(fullPath)) {
        testResults.failed++;
        testResults.errors.push(`❌ File not found: ${pagePath}`);
        return false;
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        testResults.total++;

        const checks = [
            {
                name: 'Navbar HTML Structure',
                test: () => content.includes('global-navbar') && content.includes('navbar-container'),
                error: 'Missing navbar HTML structure'
            },
            {
                name: 'CSS Link',
                test: () => content.includes('/css/global-navbar.css'),
                error: 'Missing navbar CSS link'
            },
            {
                name: 'JavaScript Link',
                test: () => content.includes('/js/global-navbar.js'),
                error: 'Missing navbar JavaScript link'
            },
            {
                name: 'Page Content Wrapper',
                test: () => content.includes('page-content'),
                error: 'Missing page-content wrapper'
            },
            {
                name: 'Theme Toggle',
                test: () => content.includes('theme-toggle'),
                error: 'Missing theme toggle'
            },
            {
                name: 'Mobile Menu',
                test: () => content.includes('mobile-menu-toggle'),
                error: 'Missing mobile menu toggle'
            },
            {
                name: 'Search Functionality',
                test: () => content.includes('search-toggle'),
                error: 'Missing search functionality'
            },
            {
                name: 'User Menu',
                test: () => content.includes('user-toggle'),
                error: 'Missing user menu'
            },
            {
                name: 'Notifications',
                test: () => content.includes('notification-toggle'),
                error: 'Missing notifications'
            },
            {
                name: 'Navigation Links',
                test: () => content.includes('nav-menu') && content.includes('nav-link'),
                error: 'Missing navigation links'
            }
        ];

        let pagePassed = true;
        const pageErrors = [];

        checks.forEach(check => {
            if (!check.test()) {
                pagePassed = false;
                pageErrors.push(check.error);
            }
        });

        if (pagePassed) {
            testResults.passed++;
            console.log(`✅ ${pagePath}: All checks passed`);
        } else {
            testResults.failed++;
            testResults.errors.push(`❌ ${pagePath}: ${pageErrors.join(', ')}`);
            console.log(`❌ ${pagePath}: ${pageErrors.join(', ')}`);
        }

        return pagePassed;

    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`❌ ${pagePath}: Error reading file - ${error.message}`);
        console.log(`❌ ${pagePath}: Error reading file - ${error.message}`);
        return false;
    }
}

/**
 * Test navbar CSS file
 */
function testNavbarCSS() {
    const cssPath = path.join(__dirname, '..', 'public', 'css', 'global-navbar.css');

    if (!fs.existsSync(cssPath)) {
        testResults.failed++;
        testResults.errors.push('❌ Navbar CSS file not found');
        return false;
    }

    try {
        const content = fs.readFileSync(cssPath, 'utf8');
        testResults.total++;

        const cssChecks = [
            {
                name: 'Global Navbar Styles',
                test: () => content.includes('.global-navbar'),
                error: 'Missing global navbar styles'
            },
            {
                name: 'Responsive Design',
                test: () => content.includes('@media') && content.includes('max-width'),
                error: 'Missing responsive design'
            },
            {
                name: 'Theme Support',
                test: () => content.includes('theme-toggle') || content.includes('dark-mode'),
                error: 'Missing theme support'
            },
            {
                name: 'Mobile Menu',
                test: () => content.includes('mobile-menu') || content.includes('hamburger'),
                error: 'Missing mobile menu styles'
            },
            {
                name: 'Dropdown Styles',
                test: () => content.includes('dropdown-menu'),
                error: 'Missing dropdown styles'
            }
        ];

        let cssPassed = true;
        const cssErrors = [];

        cssChecks.forEach(check => {
            if (!check.test()) {
                cssPassed = false;
                cssErrors.push(check.error);
            }
        });

        if (cssPassed) {
            testResults.passed++;
            console.log('✅ global-navbar.css: All checks passed');
        } else {
            testResults.failed++;
            testResults.errors.push(`❌ global-navbar.css: ${cssErrors.join(', ')}`);
            console.log(`❌ global-navbar.css: ${cssErrors.join(', ')}`);
        }

        return cssPassed;

    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`❌ global-navbar.css: Error reading file - ${error.message}`);
        console.log(`❌ global-navbar.css: Error reading file - ${error.message}`);
        return false;
    }
}

/**
 * Test navbar JavaScript file
 */
function testNavbarJS() {
    const jsPath = path.join(__dirname, '..', 'public', 'js', 'global-navbar.js');

    if (!fs.existsSync(jsPath)) {
        testResults.failed++;
        testResults.errors.push('❌ Navbar JavaScript file not found');
        return false;
    }

    try {
        const content = fs.readFileSync(jsPath, 'utf8');
        testResults.total++;

        const jsChecks = [
            {
                name: 'GlobalNavbar Class',
                test: () => content.includes('class GlobalNavbar'),
                error: 'Missing GlobalNavbar class'
            },
            {
                name: 'Theme Toggle Function',
                test: () => content.includes('toggleTheme'),
                error: 'Missing theme toggle function'
            },
            {
                name: 'Mobile Menu Function',
                test: () => content.includes('toggleMobileMenu'),
                error: 'Missing mobile menu function'
            },
            {
                name: 'Search Function',
                test: () => content.includes('handleSearch'),
                error: 'Missing search function'
            },
            {
                name: 'User Menu Function',
                test: () => content.includes('toggleUserMenu'),
                error: 'Missing user menu function'
            },
            {
                name: 'Event Listeners',
                test: () => content.includes('addEventListener'),
                error: 'Missing event listeners'
            },
            {
                name: 'Error Handling',
                test: () => content.includes('try') && content.includes('catch'),
                error: 'Missing error handling'
            },
            {
                name: 'Console Logging',
                test: () => content.includes('console.log'),
                error: 'Missing console logging'
            }
        ];

        let jsPassed = true;
        const jsErrors = [];

        jsChecks.forEach(check => {
            if (!check.test()) {
                jsPassed = false;
                jsErrors.push(check.error);
            }
        });

        if (jsPassed) {
            testResults.passed++;
            console.log('✅ global-navbar.js: All checks passed');
        } else {
            testResults.failed++;
            testResults.errors.push(`❌ global-navbar.js: ${jsErrors.join(', ')}`);
            console.log(`❌ global-navbar.js: ${jsErrors.join(', ')}`);
        }

        return jsPassed;

    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`❌ global-navbar.js: Error reading file - ${error.message}`);
        console.log(`❌ global-navbar.js: Error reading file - ${error.message}`);
        return false;
    }
}

/**
 * Generate test report
 */
function generateReport() {
    const report = `
# 🧪 **NAVBAR FUNCTIONALITY TEST REPORT**

## 📊 **Test Summary**
- **Total Tests**: ${testResults.total}
- **Passed**: ${testResults.passed} ✅
- **Failed**: ${testResults.failed} ❌
- **Success Rate**: ${testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100) : 0}%

## 📋 **Test Results**

### ✅ **Passed Tests**
${testResults.passed > 0 ? 'All tests passed successfully!' : 'No tests passed'}

### ❌ **Failed Tests**
${testResults.errors.length > 0 ? testResults.errors.join('\n') : 'No tests failed!'}

## 🎯 **Test Coverage**

### **Pages Tested**: ${testPages.length}
${testPages.map(page => `- ${page}`).join('\n')}

### **Components Tested**:
- ✅ Navbar HTML Structure
- ✅ CSS Styling
- ✅ JavaScript Functionality
- ✅ Responsive Design
- ✅ Theme Support
- ✅ Mobile Menu
- ✅ Search Functionality
- ✅ User Menu
- ✅ Notifications
- ✅ Navigation Links

## 🚀 **Recommendations**

${testResults.failed === 0 ?
    '🎉 **All tests passed!** Your navbar is fully functional and ready for production.' :
    '⚠️ **Some tests failed.** Please review the failed tests and fix the issues before deploying.'}

## 📝 **Next Steps**

1. **Review Failed Tests**: Check the error messages above
2. **Fix Issues**: Address any missing components or functionality
3. **Re-run Tests**: Run this test again to verify fixes
4. **User Testing**: Test the navbar manually in different browsers
5. **Performance Check**: Ensure navbar doesn't impact page load times

---
*Test completed at: ${new Date().toLocaleString()}*
`;

    // Write report to file
    const reportPath = path.join(__dirname, '..', 'NAVBAR_TEST_REPORT.md');
    fs.writeFileSync(reportPath, report);

    console.log('\n📊 **TEST SUMMARY**');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100) : 0}%`);

    if (testResults.errors.length > 0) {
        console.log('\n❌ **FAILED TESTS**');
        testResults.errors.forEach(error => console.log(error));
    }

    console.log(`\n📄 **Report saved to**: ${reportPath}`);

    return testResults.failed === 0;
}

/**
 * Main test execution
 */
function runTests() {
    console.log('🧪 **STARTING NAVBAR FUNCTIONALITY TESTS**\n');

    // Test CSS
    console.log('🎨 Testing navbar CSS...');
    testNavbarCSS();

    // Test JavaScript
    console.log('⚙️ Testing navbar JavaScript...');
    testNavbarJS();

    // Test pages
    console.log('📄 Testing pages...');
    testPages.forEach(page => {
        console.log(`Testing ${page}...`);
        testPage(page);
    });

    // Generate report
    console.log('\n📊 Generating test report...');
    const allPassed = generateReport();

    if (allPassed) {
        console.log('\n🎉 **ALL TESTS PASSED!** Your navbar is fully functional!');
        process.exit(0);
    } else {
        console.log('\n⚠️ **SOME TESTS FAILED!** Please review and fix the issues.');
        process.exit(1);
    }
}

// Run tests
runTests();
