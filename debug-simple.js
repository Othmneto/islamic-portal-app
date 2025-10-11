// Simple debug script to test translation functionality
console.log('🔍 [Debug] Starting simple debug...');

// Test 1: Check if elements exist
console.log('🔍 [Debug] Checking elements...');
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const translateBtn = document.getElementById('translate-btn');

console.log('Source text element:', sourceText);
console.log('Target text element:', targetText);
console.log('Translate button:', translateBtn);

// Test 2: Check if we can add event listeners
if (translateBtn) {
    console.log('✅ [Debug] Adding click listener to translate button');
    translateBtn.addEventListener('click', () => {
        console.log('🖱️ [Debug] Translate button clicked!');
        testTranslation();
    });
} else {
    console.log('❌ [Debug] Translate button not found!');
}

// Test 3: Test translation function
async function testTranslation() {
    console.log('🚀 [Debug] Testing translation...');
    
    const text = sourceText?.value || 'Hello world';
    console.log('Text to translate:', text);
    
    try {
        const response = await fetch('/api/text-translation/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourceText: text,
                sourceLanguage: 'en',
                targetLanguage: 'ar'
            })
        });
        
        const data = await response.json();
        console.log('Translation response:', data);
        
        if (data.success) {
            console.log('✅ [Debug] Translation successful!');
            console.log('Original:', data.original);
            console.log('Translated:', data.translatedText);
            
            // Try to display the result
            if (targetText) {
                targetText.value = data.translatedText;
                console.log('✅ [Debug] Result displayed in target text area');
            } else {
                console.log('❌ [Debug] Target text area not found');
            }
        } else {
            console.log('❌ [Debug] Translation failed:', data.error);
        }
    } catch (error) {
        console.error('❌ [Debug] Translation error:', error);
    }
}

// Test 4: Check if textTranslator is available
console.log('🔍 [Debug] Checking textTranslator...');
if (window.textTranslator) {
    console.log('✅ [Debug] textTranslator found!');
    console.log('Is connected:', window.textTranslator.isConnected);
    console.log('Is authenticated:', window.textTranslator.isAuthenticated);
} else {
    console.log('❌ [Debug] textTranslator not found!');
}

console.log('🔍 [Debug] Simple debug complete!');

