// Debug script to test translation functionality
console.log('🔍 [Debug] Starting translation debug...');

// Test 1: Check if elements exist
console.log('🔍 [Debug] Checking elements...');
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const translateBtn = document.getElementById('translate-btn');
const historyContainer = document.getElementById('history-list');

console.log('Source text element:', sourceText);
console.log('Target text element:', targetText);
console.log('Translate button:', translateBtn);
console.log('History container:', historyContainer);

// Test 2: Check localStorage
console.log('🔍 [Debug] Checking localStorage...');
const translationHistory = localStorage.getItem('translationHistory');
console.log('Translation history in localStorage:', translationHistory);

// Test 3: Check authentication
console.log('🔍 [Debug] Checking authentication...');
const accessToken = localStorage.getItem('accessToken');
const authToken = localStorage.getItem('authToken');
console.log('Access token:', accessToken);
console.log('Auth token:', authToken);

// Test 4: Test translation API
console.log('🔍 [Debug] Testing translation API...');
async function testTranslationAPI() {
    try {
        const response = await fetch('/api/text-translation/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourceText: 'Hello world',
                sourceLanguage: 'en',
                targetLanguage: 'ar'
            })
        });
        
        const data = await response.json();
        console.log('Translation API response:', data);
        
        if (data.success) {
            console.log('✅ Translation API working!');
            console.log('Original:', data.original);
            console.log('Translated:', data.translatedText);
            console.log('From:', data.from);
            console.log('To:', data.to);
        } else {
            console.log('❌ Translation API failed:', data.error);
        }
    } catch (error) {
        console.error('❌ Translation API error:', error);
    }
}

// Test 5: Test history API
async function testHistoryAPI() {
    try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('authToken');
        const response = await fetch('/api/translation-history/history', {
            headers: {
                'Authorization': `Bearer ${token || 'test'}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('History API response:', data);
        
        if (data.success) {
            console.log('✅ History API working!');
            console.log('Translations found:', data.data?.translations?.length || 0);
        } else {
            console.log('❌ History API failed:', data.message || data.error);
        }
    } catch (error) {
        console.error('❌ History API error:', error);
    }
}

// Test 6: Check if textTranslator is available
console.log('🔍 [Debug] Checking textTranslator...');
if (window.textTranslator) {
    console.log('✅ textTranslator found!');
    console.log('Translation history length:', window.textTranslator.translationHistory?.length || 0);
    console.log('Is connected:', window.textTranslator.isConnected);
    console.log('Is authenticated:', window.textTranslator.isAuthenticated);
} else {
    console.log('❌ textTranslator not found!');
}

// Run tests
testTranslationAPI();
testHistoryAPI();

console.log('🔍 [Debug] Debug complete!');

