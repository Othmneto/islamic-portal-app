/**
 * Calendar ICS Import Modal
 * Handles ICS file upload, preview, and import functionality
 */

class CalendarImportModal {
  constructor(calendarAPI) {
    this.api = calendarAPI;
    this.modal = null;
    this.importData = null;
    this.selectedEvents = new Set();
    this.init();
  }

  init() {
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    const modalHTML = `
      <div id="import-modal" class="modal" aria-hidden="true" role="dialog" aria-labelledby="import-modal-title">
        <div class="backdrop" data-close="import"></div>
        <div class="card import-modal-card">
          <div class="card-header">
            <strong id="import-modal-title">Import Calendar Events</strong>
            <button class="close-x" data-close="import">✕</button>
          </div>
          <div class="card-body">
            <!-- Step 1: File Upload -->
            <div id="import-step-1" class="import-step">
              <div class="upload-area" id="upload-area">
                <div class="upload-icon">📅</div>
                <h3>Upload ICS Calendar File</h3>
                <p>Drag and drop your .ics file here or click to browse</p>
                <input type="file" id="ics-file-input" accept=".ics" style="display: none;">
                <button type="button" class="btn primary" onclick="document.getElementById('ics-file-input').click()">
                  Choose File
                </button>
                <div class="file-info" id="file-info" style="display: none;">
                  <span id="file-name"></span>
                  <span id="file-size"></span>
                </div>
              </div>
            </div>

            <!-- Step 2: Preview Events -->
            <div id="import-step-2" class="import-step" style="display: none;">
              <h3>Preview Events</h3>
              <div class="import-summary">
                <p>Found <span id="total-events">0</span> events in the file</p>
                <p>Select which events to import:</p>
              </div>
              <div class="import-controls">
                <button type="button" class="btn ghost btn-sm" id="select-all-events">Select All</button>
                <button type="button" class="btn ghost btn-sm" id="deselect-all-events">Deselect All</button>
              </div>
              <div class="events-preview" id="events-preview">
                <!-- Events will be populated here -->
              </div>
            </div>

            <!-- Step 3: Import Progress -->
            <div id="import-step-3" class="import-step" style="display: none;">
              <h3>Importing Events</h3>
              <div class="import-progress">
                <div class="progress-bar">
                  <div class="progress-fill" id="progress-fill"></div>
                </div>
                <p id="progress-text">Preparing import...</p>
              </div>
            </div>

            <!-- Step 4: Import Complete -->
            <div id="import-step-4" class="import-step" style="display: none;">
              <h3>Import Complete</h3>
              <div class="import-results">
                <p>✅ Successfully imported <span id="imported-count">0</span> events</p>
                <p>⚠️ Skipped <span id="skipped-count">0</span> duplicate events</p>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn ghost" data-close="import">Cancel</button>
            <button class="btn primary" id="import-confirm" style="display: none;">Import Selected Events</button>
            <button class="btn primary" id="import-done" style="display: none;">Done</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('import-modal');
  }

  bindEvents() {
    // File input change
    document.getElementById('ics-file-input').addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files[0]);
    });

    // Drag and drop
    const uploadArea = document.getElementById('upload-area');
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // Select all/none buttons
    document.getElementById('select-all-events').addEventListener('click', () => {
      this.selectAllEvents();
    });

    document.getElementById('deselect-all-events').addEventListener('click', () => {
      this.deselectAllEvents();
    });

    // Import confirm button
    document.getElementById('import-confirm').addEventListener('click', () => {
      this.confirmImport();
    });

    // Import done button
    document.getElementById('import-done').addEventListener('click', () => {
      this.closeModal();
    });

    // Close modal events
    this.modal.addEventListener('click', (e) => {
      if (e.target.getAttribute('data-close') === 'import') {
        this.closeModal();
      }
    });
  }

  async handleFileSelect(file) {
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.ics') && file.type !== 'text/calendar') {
      alert('Please select a valid .ics calendar file.');
      return;
    }

    // Show file info
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = this.formatFileSize(file.size);
    document.getElementById('file-info').style.display = 'block';

    try {
      // Upload and parse file
      const result = await this.api.uploadICSFile(file);
      
      if (result.success) {
        this.importData = result;
        this.showStep(2);
        this.renderEventsPreview(result.events);
      } else {
        alert('Failed to parse ICS file: ' + result.error);
      }
    } catch (error) {
      console.error('Error uploading ICS file:', error);
      alert('Error uploading file: ' + error.message);
    }
  }

  renderEventsPreview(events) {
    const container = document.getElementById('events-preview');
    const totalEvents = document.getElementById('total-events');
    
    totalEvents.textContent = events.length;
    container.innerHTML = '';

    events.forEach((event, index) => {
      const eventElement = this.createEventPreviewElement(event, index);
      container.appendChild(eventElement);
    });

    // Show import confirm button
    document.getElementById('import-confirm').style.display = 'inline-block';
  }

  createEventPreviewElement(event, index) {
    const div = document.createElement('div');
    div.className = 'event-preview-item';
    div.innerHTML = `
      <label class="event-preview-label">
        <input type="checkbox" class="event-checkbox" value="${index}" checked>
        <div class="event-preview-content">
          <div class="event-preview-title">${event.title || 'Untitled Event'}</div>
          <div class="event-preview-details">
            <span class="event-date">${this.formatEventDate(event.startDate)}</span>
            ${event.location ? `<span class="event-location">📍 ${event.location}</span>` : ''}
            ${event.description ? `<span class="event-description">${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}</span>` : ''}
          </div>
        </div>
      </label>
    `;

    // Add checkbox change handler
    const checkbox = div.querySelector('.event-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.selectedEvents.add(index);
      } else {
        this.selectedEvents.delete(index);
      }
      this.updateImportButton();
    });

    // Initialize as selected
    this.selectedEvents.add(index);

    return div;
  }

  selectAllEvents() {
    document.querySelectorAll('.event-checkbox').forEach(checkbox => {
      checkbox.checked = true;
      this.selectedEvents.add(parseInt(checkbox.value));
    });
    this.updateImportButton();
  }

  deselectAllEvents() {
    document.querySelectorAll('.event-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    this.selectedEvents.clear();
    this.updateImportButton();
  }

  updateImportButton() {
    const button = document.getElementById('import-confirm');
    const count = this.selectedEvents.size;
    button.textContent = `Import ${count} Selected Events`;
    button.disabled = count === 0;
  }

  async confirmImport() {
    if (this.selectedEvents.size === 0) {
      alert('Please select at least one event to import.');
      return;
    }

    this.showStep(3);
    
    try {
      const selectedEvents = Array.from(this.selectedEvents).map(index => this.importData.events[index]);
      const result = await this.api.confirmICSImport(this.importData.importId, selectedEvents);
      
      if (result.success) {
        this.showStep(4);
        document.getElementById('imported-count').textContent = result.importedCount;
        document.getElementById('skipped-count').textContent = result.skippedCount;
        
        // Refresh calendar if it exists
        if (window.CalendarState && window.CalendarState.render) {
          window.CalendarState.render();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error confirming import:', error);
      alert('Error importing events: ' + error.message);
      this.showStep(2);
    }
  }

  showStep(stepNumber) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`import-step-${i}`).style.display = 'none';
    }
    
    // Show current step
    document.getElementById(`import-step-${stepNumber}`).style.display = 'block';
    
    // Update buttons
    document.getElementById('import-confirm').style.display = stepNumber === 2 ? 'inline-block' : 'none';
    document.getElementById('import-done').style.display = stepNumber === 4 ? 'inline-block' : 'none';
  }

  openModal() {
    this.modal.setAttribute('aria-hidden', 'false');
    this.modal.style.display = 'flex';
    this.showStep(1);
    this.resetModal();
  }

  closeModal() {
    this.modal.setAttribute('aria-hidden', 'true');
    this.modal.style.display = 'none';
    this.resetModal();
  }

  resetModal() {
    this.importData = null;
    this.selectedEvents.clear();
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('ics-file-input').value = '';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatEventDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.CalendarImportModal = CalendarImportModal;
}





