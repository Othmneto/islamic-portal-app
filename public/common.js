// translator-backend - full/public/common.js

// --- Authentication Helper Functions ---

// Function to get the stored JWT token
function getToken() {
    // Use token manager if available, otherwise fallback to old method
    if (window.tokenManager && window.tokenManager.isAuthenticated()) {
        return window.tokenManager.getAccessToken();
    }

    return localStorage.getItem('authToken') ||
           localStorage.getItem('token') ||
           localStorage.getItem('jwt') ||
           localStorage.getItem('access_token');
}

// Function to remove the stored JWT token (for logout)
function removeToken() {
    // Use token manager if available
    if (window.tokenManager) {
        window.tokenManager.clearTokens();
    } else {
        // Fallback to old method
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        localStorage.removeItem('jwt');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refreshToken');
    }

    // Clear any specific user data from local storage if applicable
    localStorage.removeItem('userData');
    localStorage.removeItem('userPreferences');
    localStorage.removeItem('savedLocations');
}

// Enhanced logout function with API call
async function logout() {
    try {
        // Use token manager if available
        if (window.tokenManager) {
            await window.tokenManager.logout();
            return true;
        }

        // Fallback to old method
        const token = getToken();

        if (token) {
            // Call logout API to log the event server-side
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    console.log('✅ Logout API call successful');
                } else if (response.status === 401) {
                    console.log('ℹ️ Token already expired, proceeding with client-side logout');
                } else {
                    console.warn('⚠️ Logout API call failed, but continuing with client-side logout');
                }
            } catch (apiError) {
                console.warn('⚠️ Logout API call failed:', apiError.message);
                // Continue with client-side logout even if API fails
            }
        }

        // Clear all client-side data
        removeToken();

        // Clear any session storage
        sessionStorage.clear();

        // Clear any cookies (if any)
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        console.log('🔓 Logout completed successfully');
        return true;

    } catch (error) {
        console.error('❌ Logout error:', error);
        // Even if there's an error, clear local data
        removeToken();
        return false;
    }
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
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault();

            // Show confirmation dialog
            if (confirm('Are you sure you want to logout?')) {
                // Show loading state
                logoutLink.textContent = 'Logging out...';
                logoutLink.style.pointerEvents = 'none';

                try {
                    // Call enhanced logout function
                    const success = await logout();

                    if (success) {
                        // Show success message
                        alert('You have been logged out successfully.');

                        // Redirect to home page
                        window.location.href = 'index.html';
                    } else {
                        // This should rarely happen now since we handle errors gracefully
                        console.warn('Logout completed with some issues, but data was cleared');
                        alert('You have been logged out. Redirecting...');
                        window.location.href = 'index.html';
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    // Even if there's an error, clear local data and redirect
                    removeToken();
                    alert('You have been logged out. Redirecting...');
                    window.location.href = 'index.html';
                }
            }
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
        if (currentTheme === 'dark' && themeSwitch) {
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