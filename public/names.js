// translator-backend - full/public/names.js

console.log("names.js: Script loaded successfully. Starting initialization."); // ADD THIS LINE (very first line in the file)

document.addEventListener('DOMContentLoaded', async () => {
    console.log("names.js: DOMContentLoaded event fired. Proceeding with Names page logic."); // ADD THIS LINE

    const namesListContainer = document.getElementById('names-list');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const explanationLangSelect = document.getElementById('explanation-lang-select');

    // Crucial checks for HTML elements. If these are missing, it will cause errors.
    if (!namesListContainer) { console.error("names.js ERROR: HTML element with ID 'names-list' not found! Cannot display names."); return; }
    if (!loadingMessage) { console.error("names.js ERROR: HTML element with ID 'loading-message' not found!"); return; }
    if (!errorMessage) { console.error("names.js ERROR: HTML element with ID 'error-message' not found!"); return; }
    // The explanationLangSelect might be null if not needed for some layouts, but it's used directly
    if (!explanationLangSelect) { console.error("names.js ERROR: HTML element with ID 'explanation-lang-select' not found! Language switcher will not work."); /* Don't return, as names might still load */ }
    
    let allNames = []; // To store all fetched names
    let availableExplanationLanguages = new Set(); // To store unique languages from explanations

    // Function to create an individual Name card HTML
    function createNameCardHTML(name) {
        const isUniqueTag = name.is_unique_to_Allah ? '<span class="is-unique-tag">Unique to Allah</span>' : '';

        // Populate language options from the explanations/invocations available in this specific name
        // This ensures the dropdown only shows languages that actually have content for at least one name.
        if (name.explanations && typeof name.explanations === 'object') { // Defensive check
            for (const langCode in name.explanations) {
                if (Object.prototype.hasOwnProperty.call(name.explanations, langCode)) {
                    availableExplanationLanguages.add(langCode);
                }
            }
        }
        if (name.invocation && typeof name.invocation === 'object') { // Defensive check
            for (const langCode in name.invocation) {
                if (Object.prototype.hasOwnProperty.call(name.invocation, langCode)) {
                    availableExplanationLanguages.add(langCode);
                }
            }
        }

        return `
            <div class="name-card" data-id="${name.id}">
                <div class="name-header">
                    <h3>${name.id}. ${name.name} <span class="name-transliteration">(${name.transliteration})</span></h3>
                    ${isUniqueTag}
                    <i class="fas fa-chevron-right"></i>
                </div>
                <div class="name-content">
                    <div class="name-tabs">
                        <button class="name-tab-button active" data-tab-type="explanation">Explanations</button>
                        <button class="name-tab-button" data-tab-type="invocation">Invocations</button>
                    </div>
                    <div class="name-tab-panel-container">
                        <div class="name-tab-content active" data-tab-type="explanation-content">
                            </div>
                        <div class="name-tab-content" data-tab-type="invocation-content">
                            </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Function to render names to the DOM
    function renderNames(names) {
        namesListContainer.innerHTML = ''; // Clear existing names
        names.forEach(name => {
            // Check for minimum required fields before creating card HTML
            if (name.id && name.name && name.transliteration) {
                namesListContainer.innerHTML += createNameCardHTML(name);
            } else {
                console.warn("names.js Warning: Skipping name due to missing essential fields:", name);
            }
        });
        attachEventListeners(); // Attach event listeners after rendering
        // Only populate language switcher if the element exists
        if (explanationLangSelect) {
            populateLanguageSwitcher(Array.from(availableExplanationLanguages).sort()); // Sort languages for display
        }
    }

    // Function to populate the language selection dropdown
    function populateLanguageSwitcher(languages) {
        explanationLangSelect.innerHTML = ''; // Clear existing options

        // Prioritize English, then Arabic, then others
        const orderedLangs = ['en', 'ar'].filter(lang => languages.includes(lang));
        const otherLangs = languages.filter(lang => !orderedLangs.includes(lang));
        const finalLangs = [...orderedLangs, ...otherLangs];

        if (finalLangs.length === 0) {
            // If no languages found, hide the switcher or show a message
            explanationLangSelect.style.display = 'none';
            // You might want to add a message to the UI here that no language options are available
            console.warn("names.js Warning: No explanation languages found in data, hiding language switcher.");
            return;
        } else {
            explanationLangSelect.style.display = 'inline-block'; // Ensure it's visible if hidden
        }


        finalLangs.forEach(langCode => {
            const option = document.createElement('option');
            option.value = langCode;
            option.textContent = getLanguageName(langCode); // Helper to get full language name
            explanationLangSelect.appendChild(option);
        });

        // Set default language based on user preference (Phase 2), for now, English or first available
        const defaultLang = localStorage.getItem('names_explanation_language') || (finalLangs.includes('en') ? 'en' : finalLangs[0]);
        if (defaultLang && finalLangs.includes(defaultLang)) { // Ensure defaultLang is actually an available option
            explanationLangSelect.value = defaultLang;
        } else if (finalLangs.length > 0) { // Fallback to first available if default not found
             explanationLangSelect.value = finalLangs[0];
        }

        updateAllNameCardContent(); // Update content based on selected language
    }

    // Helper to get full language name (can be expanded)
    function getLanguageName(code) {
        const langMap = {
            'ar': 'Arabic', 'en': 'English', 'fr': 'French', 'id': 'Indonesian', 'ur': 'Urdu',
            'bn': 'Bengali', 'tr': 'Turkish', 'fa': 'Persian', 'sw': 'Swahili', 'ha': 'Hausa',
            'ber': 'Berber', 'zh': 'Chinese', 'ms': 'Malay', 'am': 'Amharic'
        };
        return langMap[code] || code.toUpperCase(); // Fallback to uppercase code if name not mapped
    }

    // Function to update the content within the name cards based on selected language
    function updateAllNameCardContent() {
        if (!explanationLangSelect) { // Safety check
            console.error("names.js ERROR: Cannot update content, language select dropdown is missing.");
            return;
        }
        const selectedLang = explanationLangSelect.value;
        document.querySelectorAll('.name-card').forEach(cardElement => {
            const nameId = cardElement.dataset.id;
            const name = allNames.find(n => n.id == nameId); // Use == for comparison with string data-id

            if (!name) return; // Should not happen if allNames is correctly populated

            const explanationContentDiv = cardElement.querySelector('[data-tab-type="explanation-content"]');
            const invocationContentDiv = cardElement.querySelector('[data-tab-type="invocation-content"]');

            if (!explanationContentDiv || !invocationContentDiv) {
                console.error(`names.js ERROR: Missing content divs for name ID ${nameId}.`);
                return; // Skip if essential HTML elements are missing
            }


            // Render Explanations
            let explanationsHtml = `<p>No explanations available in ${getLanguageName(selectedLang)}.</p>`;
            // Check if name.explanations is an object and contains the selected language
            if (name.explanations && typeof name.explanations === 'object' && name.explanations[selectedLang]) {
                const explanationsForLang = name.explanations[selectedLang];
                // Ensure explanationsForLang is also an object before iterating over sources
                if (typeof explanationsForLang === 'object') {
                    explanationsHtml = '<h4>Explanations:</h4><ul>';
                    for (const source in explanationsForLang) {
                        if (Object.prototype.hasOwnProperty.call(explanationsForLang, source)) { // Best practice for iterating objects
                             explanationsHtml += `<li><strong>${source}:</strong> ${explanationsForLang[source]}</li>`;
                        }
                    }
                    explanationsHtml += '</ul>';
                }
            }
            explanationContentDiv.innerHTML = explanationsHtml;

            // Render Invocations
            let invocationsHtml = `<p>No invocations available in ${getLanguageName(selectedLang)}.</p>`;
            // Check if name.invocation is an object and contains the selected language
            if (name.invocation && typeof name.invocation === 'object' && name.invocation[selectedLang]) {
                invocationsHtml = '<h4>Invocation:</h4><p>' + name.invocation[selectedLang] + '</p>';
            }
            invocationContentDiv.innerHTML = invocationsHtml;

        });
    }


    // Function to attach all event listeners
    function attachEventListeners() {
        // Expand/Collapse Name Cards
        document.querySelectorAll('.name-header').forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.name-card');
                if (card) { // Safety check
                    card.classList.toggle('expanded');
                    console.log(`names.js: Card ${card.dataset.id} toggled expanded.`); // ADD THIS LINE
                }
            });
        });

        // Tab Switching (Explanations/Invocations)
        document.querySelectorAll('.name-card .name-tab-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const clickedButton = event.target;
                const card = clickedButton.closest('.name-card');
                const tabType = clickedButton.dataset.tabType; // 'explanation' or 'invocation'

                if (!card) { console.error("names.js ERROR: Tab button clicked but parent card not found."); return; } // Safety check

                console.log(`names.js: Tab button clicked: ${tabType} for card ${card.dataset.id}.`); // ADD THIS LINE

                // Deactivate all tab buttons and content panels within this card
                card.querySelectorAll('.name-tab-button').forEach(btn => btn.classList.remove('active'));
                card.querySelectorAll('.name-tab-content').forEach(content => content.classList.remove('active'));

                // Activate the clicked button and its corresponding content panel
                clickedButton.classList.add('active');
                const targetContent = card.querySelector(`[data-tab-type="${tabType}-content"]`);
                if (targetContent) { // Safety check
                    targetContent.classList.add('active');
                } else {
                    console.error(`names.js ERROR: Target content panel for tab type ${tabType} not found.`);
                }
            });
        });
    }

    // Fetch names data on page load
    try {
        console.log("names.js: Initializing fetch process for names."); // ADD THIS LINE
        loadingMessage.style.display = 'block'; // Show loading message
        errorMessage.style.display = 'none';    // Hide any previous errors

        const response = await fetch('/api/names'); // Fetch from our backend API
        
        console.log("names.js: Fetch response status:", response.status); // ADD THIS LINE
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allNames = await response.json(); // Store all names globally
        console.log("names.js: Fetched and parsed names data. Number of items:", allNames.length); // ADD THIS LINE
        loadingMessage.style.display = 'none'; // Hide loading message

        if (allNames.length > 0) {
            renderNames(allNames); // Render all names if data is present
            console.log("names.js: Names rendered successfully."); // ADD THIS LINE
        } else {
            namesListContainer.innerHTML = '<p>No Names of Allah found.</p>';
            console.warn("names.js: API returned an empty array of names."); // ADD THIS LINE
        }

    } catch (error) {
        console.error('names.js ERROR: An error occurred during fetching or processing 99 Names:', error); // MODIFIED ERROR LOG
        if (loadingMessage) loadingMessage.style.display = 'none'; // Added checks for null elements
        if (errorMessage) errorMessage.style.display = 'block';     // Added checks
        namesListContainer.innerHTML = '<p style="color:var(--danger-color);">Error loading names. Please try again later.</p>'; // Display general error on page
    }
});