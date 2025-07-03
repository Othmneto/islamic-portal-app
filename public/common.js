// Add this function to the end of common.js

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