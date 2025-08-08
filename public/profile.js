// public/profile.js (Corrected)

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('city-search');
    const searchButton = document.getElementById('search-button');
    const searchResultsDiv = document.getElementById('search-results');
    const currentLocationSpan = document.getElementById('current-location');
    const messageDiv = document.getElementById('profile-message');

    // Helper to get the CSRF token from the document's cookies
    function getCsrfToken() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; XSRF-TOKEN=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // This handles searching for a city. It's a GET request.
    const handleSearch = async () => {
        const query = searchInput.value;
        if (query.length < 3) return;
        
        const response = await fetch(`/api/search-city?query=${encodeURIComponent(query)}`, {
            // Crucial: This tells the browser to send the session cookie
            credentials: 'include' 
        });
        const results = await response.json();
        displayResults(results);
    };

    const displayResults = (results) => {
        searchResultsDiv.innerHTML = '';
        if (!results || results.length === 0) {
            searchResultsDiv.innerHTML = '<p>No cities found.</p>';
            return;
        }
        results.forEach(location => {
            const resultButton = document.createElement('button');
            resultButton.className = 'location-result-btn';
            resultButton.textContent = `${location.city}, ${location.country}`;
            resultButton.onclick = () => saveLocation(location);
            searchResultsDiv.appendChild(resultButton);
        });
    };

    // This saves the user's selected location. It's a PUT request.
    const saveLocation = async (location) => {
        messageDiv.textContent = 'Saving...';
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
            messageDiv.textContent = 'Error: CSRF token not found. Please refresh and log in again.';
            return;
        }

        const response = await fetch('/api/user/location', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                // Crucial: The CSRF token must be sent in the headers for non-GET requests
                'X-CSRF-Token': csrfToken
            },
            // Crucial: This sends the session cookie
            credentials: 'include', 
            body: JSON.stringify(location)
        });

        if (response.ok) {
            messageDiv.textContent = 'Location saved successfully!';
            currentLocationSpan.textContent = `${location.city}, ${location.country}`;
            searchResultsDiv.innerHTML = '';
        } else {
            const errorData = await response.json();
            messageDiv.textContent = `Error: ${errorData.msg || 'Failed to save location.'}`;
        }
    };

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleSearch();
    });
});