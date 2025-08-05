// public/profile.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const searchInput = document.getElementById('city-search');
    const searchButton = document.getElementById('search-button');
    const searchResultsDiv = document.getElementById('search-results');
    const currentLocationSpan = document.getElementById('current-location');
    const messageDiv = document.getElementById('profile-message');

    const handleSearch = async () => {
        const query = searchInput.value;
        if (query.length < 3) {
            searchResultsDiv.innerHTML = '<p>Please enter at least 3 characters.</p>';
            return;
        }
        const response = await fetch(`/api/search-city?query=${encodeURIComponent(query)}`);
        const results = await response.json();
        displayResults(results);
    };

    const displayResults = (results) => {
        searchResultsDiv.innerHTML = '';
        if (results.length === 0) {
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

    const saveLocation = async (location) => {
        messageDiv.textContent = 'Saving...';
        
        // --- ADDED FOR DEBUGGING ---
        console.log('Sending location to save:', location);

        const response = await fetch('/api/user/location', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(location)
        });

        if (response.ok) {
            messageDiv.textContent = 'Location saved successfully!';
            currentLocationSpan.textContent = `${location.city}, ${location.country}`;
            searchResultsDiv.innerHTML = '';
        } else {
            messageDiv.textContent = 'Failed to save location.';
        }
    };

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
});