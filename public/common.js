// translator-backend - full/public/common.js

// --- Authentication Helper Functions ---

// Function to get the stored JWT token
function getToken() {
    return localStorage.getItem('token');
}

// Function to remove the stored JWT token (for logout)
function removeToken() {
    localStorage.removeItem('token');
    // Clear any specific user data from local storage if applicable
}

// Function to check if a user is logged in (by checking for a token)
function isLoggedIn() {
    const token = getToken();
    // A more robust check would involve verifying the token's expiry date
    // For now, simply checking for its presence is sufficient
    return token !== null;
}

// Function to update the navigation bar based on login status
function updateNavBar() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return; // Exit if navLinks element not found

    // Remove existing login/register/logout links
    const existingAuthLinks = navLinks.querySelector('#auth-links');
    if (existingAuthLinks) {
        existingAuthLinks.remove();
    }

    const authLinksContainer = document.createElement('li');
    authLinksContainer.id = 'auth-links';

    if (isLoggedIn()) {
        // If logged in, show Logout and potentially a profile link later
        const logoutLink = document.createElement('a');
        logoutLink.href = '#'; // Placeholder, we'll handle click event
        logoutLink.textContent = 'Logout';
        logoutLink.id = 'logout-link';
        authLinksContainer.appendChild(logoutLink);

        // Add event listener for logout
        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            removeToken();
            alert('You have been logged out.');
            window.location.href = 'index.html'; // Redirect to home page
        });
    } else {
        // If not logged in, show Register and Login links
        const registerLink = document.createElement('a');
        registerLink.href = 'register.html';
        registerLink.textContent = 'Register';
        
        const loginLink = document.createElement('a');
        loginLink.href = 'login.html';
        loginLink.textContent = 'Login';

        authLinksContainer.appendChild(registerLink);
        authLinksContainer.appendChild(loginLink);
    }
    navLinks.appendChild(authLinksContainer);
}


// --- Theme Toggle Logic (existing functionality) ---
document.addEventListener('DOMContentLoaded', () => {
    const themeSwitch = document.getElementById('theme-switch');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            themeSwitch.checked = true;
        }
    }

    if (themeSwitch) {
        themeSwitch.addEventListener('change', () => {
            if (themeSwitch.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // Call updateNavBar when the page loads to set the correct links
    updateNavBar();
});


// --- History Item HTML Generation Function (your provided code) ---

function createHistoryItemHTML(item, selectedItems = new Set()) {
    const isChecked = selectedItems.has(item.id) ? 'checked' : '';
    const contextIcon = (item.context && item.context.trim().length > 0)
        ? `<i class="fa-solid fa-brain" title="Translated using semantic context"></i>`
        : '';
    const favoriteClass = item.isFavorite ? 'favorited' : '';
    const favoriteIcon = item.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star';
    const conversationButton = item.sessionId
        ? `<button class="conversation-view-btn" data-session-id="${item.sessionId}" title="View Conversation"><i class="fa-solid fa-comments"></i></button>`
        : '';
    let contextHTML = '';
    if (item.context && item.context.trim().length > 0) {
        const contextItems = item.context.split('\n').map(line => `<li>${line}</li>`).join('');
        contextHTML = `<details class="context-panel"><summary>Translated using semantic context</summary><ul>${contextItems}</ul></details>`;
    }
    const replayCount = item.replayCount || 0;
    const replayCountHTML = `<span class="replay-count" id="replay-count-${item.id}">${replayCount}</span>`;
    const translatedTextId = `translated-text-${item.id}`;
    
    return `
        <input type="checkbox" class="history-item-checkbox" data-id="${item.id}" ${isChecked}>
        <div class="history-item-content">
            <p class="original-text" style="font-style: italic; color: var(--text-secondary);">Original: ${item.original}</p>
            <p id="${translatedTextId}" class="translated-text" style="font-weight: bold;">Translated (${item.to}): ${item.translated}</p>
            ${contextHTML}
            <div class="history-controls">
                <span class="history-meta">${item.from} ${contextIcon}</span>
                <div>
                    ${replayCountHTML}
                    ${conversationButton}
                    <button class="translate-other-lang-btn" data-id="${item.id}" data-original-text="${item.original}" data-original-lang="${item.from}" data-session-id="${item.sessionId}" title="Translate to Other Languages"><i class="fa-solid fa-language"></i></button>
                    <button class="favorite-btn ${favoriteClass}" data-id="${item.id}" title="Toggle Favorite">
                        <i class="${favoriteIcon}"></i>
                    </button>
                    <button class="edit-btn" data-id="${item.id}" title="Edit and Retranslate"><i class="fa-solid fa-pencil"></i></button>
                    <button class="copy-btn" data-target-id="${translatedTextId}" title="Copy"><i class="fa-solid fa-copy"></i></button>
                    <button class="replay-btn" data-id="${item.id}" data-audio-id="${item.audioId}" title="Replay"><i class="fa-solid fa-play"></i></button>
                    <button class="delete-btn" data-id="${item.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
}