document.addEventListener('DOMContentLoaded', () => {
    const namesContainer = document.getElementById('names-container');

    fetch('/api/names')
        .then(response => response.json())
        .then(names => {
            namesContainer.innerHTML = ''; // Clear loading message
            names.forEach(name => {
                const card = document.createElement('div');
                card.className = 'name-card';

                card.innerHTML = `
                    <div class="name-number">${name.number}</div>
                    <h2 class="name-arabic">${name.arabic}</h2>
                    <p class="name-transliteration">${name.transliteration}</p>
                    <p class="name-translation">${name.translation}</p>
                `;

                namesContainer.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error fetching names:', error);
            namesContainer.innerHTML = '<p>Could not load the 99 Names. Please try again later.</p>';
        });
});