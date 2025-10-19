// public/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('notification-settings-form');
    const messageDiv = document.getElementById('settings-message');
    // Get token from multiple possible sources (consistent with other pages)
    const token = localStorage.getItem('authToken') ||
                  localStorage.getItem('token') ||
                  localStorage.getItem('jwt') ||
                  localStorage.getItem('access_token');

    // ------------------------------- Logout Functionality -------------------------------
    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async (event) => {
        event.preventDefault();

        // Show confirmation dialog
        if (confirm('Are you sure you want to logout?')) {
            // Show loading state
            const logoutBtn = document.getElementById('logout-btn');
            const originalText = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
            logoutBtn.disabled = true;

            try {
                // Call enhanced logout function
                const success = await logout();

                if (success) {
                    // Show success message
                    alert('You have been logged out successfully.');

                    // Redirect to home page
                    window.location.href = 'index.html';
                } else {
                    // Show error message but still redirect
                    alert('Logout completed with some issues. You have been redirected.');
                    window.location.href = 'index.html';
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('Logout completed with errors. You have been redirected.');
                window.location.href = 'index.html';
            }
        }
    });

    const showMessage = (text, type) => {
        messageDiv.textContent = text;
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        setTimeout(() => messageDiv.textContent = '', 3000);
    };

    // Fetches current settings and populates the form
    async function loadSettings() {
        if (!token) {
            showMessage('You must be logged in to view settings.', 'error');
            return;
        }
        try {
            const response = await fetch('/api/user/preferences', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load settings.');

            const prefs = await response.json();
            if (prefs.prayerReminders) {
                for (const prayer in prefs.prayerReminders) {
                    if (form.elements[prayer]) {
                        form.elements[prayer].checked = prefs.prayerReminders[prayer];
                    }
                }
            }
            if (form.elements.specialAnnouncements) {
                form.elements.specialAnnouncements.checked = prefs.specialAnnouncements;
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    // Handles form submission to save updated settings
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!token) {
            showMessage('You must be logged in to save settings.', 'error');
            return;
        }
        showMessage('Saving...', 'info');

        const updatedPrefs = {
            prayerReminders: {
                fajr: form.elements.fajr.checked,
                dhuhr: form.elements.dhuhr.checked,
                asr: form.elements.asr.checked,
                maghrib: form.elements.maghrib.checked,
                isha: form.elements.isha.checked,
            },
            specialAnnouncements: form.elements.specialAnnouncements.checked,
        };

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notificationPreferences: updatedPrefs })
            });

            if (!response.ok) throw new Error('Failed to save settings.');
            showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    loadSettings();
});