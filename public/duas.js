// Replace the existing content of duas.js with this enhanced version.

document.addEventListener('DOMContentLoaded', () => {
    const duasContainer = document.getElementById('duas-container');

    fetch('/api/duas')
        .then(response => {
            if (!response.ok) {
                // If the server response is not OK, create an error to be caught by the .catch block
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            return response.json();
        })
        .then(duas => {
            if (duas.length === 0) {
                duasContainer.innerHTML = '<p>No duas found.</p>';
                return;
            }
            duasContainer.innerHTML = ''; // Clear loading message
            duas.forEach(dua => {
                const card = document.createElement('div');
                card.className = 'dua-card';

                card.innerHTML = `
                    <h3>${dua.title}</h3>
                    <p class="dua-arabic">${dua.arabic}</p>
                    <p class="dua-transliteration">${dua.transliteration}</p>
                    <p class="dua-translation">${dua.translation}</p>
                `;

                duasContainer.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error fetching duas:', error);
            // Display a more user-friendly error message in the UI
            duasContainer.innerHTML = `
                <div style="text-align: center; color: var(--danger-color); padding: 2rem; background-color: var(--tertiary-bg); border-radius: 8px;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p><strong>Could not load duas.</strong></p>
                    <p><small>${error.message}</small></p>
                </div>
            `;
        });
});