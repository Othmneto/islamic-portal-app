/**
 * Calendar Event Modal Handler
 * Manages the advanced event creation/edit modal
 */

class CalendarEventModal {
  constructor(calendarAPI) {
    this.api = calendarAPI;
    this.modal = document.getElementById('event-modal');
    this.form = document.getElementById('event-form');
    this.currentEvent = null;
    this.editMode = false;
    
    this.init();
  }

  init() {
    console.log('🎨 [EventModal] Initializing event modal');
    
    // Modal open/close handlers
    this.setupModalHandlers();
    
    // Form field handlers
    this.setupFormHandlers();
    
    // Button handlers
    this.setupButtonHandlers();
    
    // Recurrence handlers
    this.setupRecurrenceHandlers();
    
    // Reminder handlers
    this.setupReminderHandlers();
  }

  /**
   * Setup modal open/close handlers
   */
  setupModalHandlers() {
    // Close modal on backdrop click or close button
    document.querySelectorAll('[data-close="event"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // Prevent modal close when clicking inside card
    const card = this.modal.querySelector('.card');
    if (card) {
      card.addEventListener('click', (e) => e.stopPropagation());
    }

    // Listen for create event button in day modal
    const createEventBtn = document.getElementById('create-event-on-day');
    if (createEventBtn) {
      createEventBtn.addEventListener('click', () => {
        const dayModal = document.getElementById('day-modal');
        const selectedDate = dayModal.getAttribute('data-selected-date');
        this.openModal(null, selectedDate);
        this.closeOtherModal('day');
      });
    }
  }

  /**
   * Setup form field handlers
   */
  setupFormHandlers() {
    // All-day toggle
    const allDayCheckbox = document.getElementById('event-all-day');
    if (allDayCheckbox) {
      allDayCheckbox.addEventListener('change', (e) => {
        const timeFields = [
          document.getElementById('event-start-time'),
          document.getElementById('event-end-time')
        ];
        timeFields.forEach(field => {
          if (field) field.disabled = e.target.checked;
        });
      });
    }

    // Auto-fill end date when start date changes
    const startDateField = document.getElementById('event-start-date');
    const endDateField = document.getElementById('event-end-date');
    if (startDateField && endDateField) {
      startDateField.addEventListener('change', (e) => {
        if (!endDateField.value) {
          endDateField.value = e.target.value;
        }
      });
    }

    // Auto-fill end time (1 hour after start)
    const startTimeField = document.getElementById('event-start-time');
    const endTimeField = document.getElementById('event-end-time');
    if (startTimeField && endTimeField) {
      startTimeField.addEventListener('change', (e) => {
        if (!endTimeField.value && e.target.value) {
          const [hours, minutes] = e.target.value.split(':');
          const endHours = (parseInt(hours) + 1).toString().padStart(2, '0');
          endTimeField.value = `${endHours}:${minutes}`;
        }
      });
    }
  }

  /**
   * Setup button handlers
   */
  setupButtonHandlers() {
    // Save event button
    const saveBtn = document.getElementById('save-event');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveEvent();
      });
    }

    // Save as template button
    const templateBtn = document.getElementById('save-as-template');
    if (templateBtn) {
      templateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveAsTemplate();
      });
    }

    // View conflicts button
    const conflictsBtn = document.getElementById('view-conflicts');
    if (conflictsBtn) {
      conflictsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.viewConflicts();
      });
    }
  }

  /**
   * Setup recurrence handlers
   */
  setupRecurrenceHandlers() {
    const recurringCheckbox = document.getElementById('event-recurring');
    const recurrenceOptions = document.getElementById('recurrence-options');
    const endTypeSelect = document.getElementById('recurrence-end-type');
    const endDateField = document.getElementById('recurrence-end-date-field');
    const countField = document.getElementById('recurrence-count-field');

    if (recurringCheckbox && recurrenceOptions) {
      recurringCheckbox.addEventListener('change', (e) => {
        recurrenceOptions.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    if (endTypeSelect && endDateField && countField) {
      endTypeSelect.addEventListener('change', (e) => {
        endDateField.style.display = e.target.value === 'on' ? 'block' : 'none';
        countField.style.display = e.target.value === 'after' ? 'block' : 'none';
      });
    }
  }

  /**
   * Setup reminder handlers
   */
  setupReminderHandlers() {
    const addReminderBtn = document.getElementById('add-reminder');
    if (addReminderBtn) {
      addReminderBtn.addEventListener('click', () => this.addReminder());
    }

    // Handle remove reminder buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-reminder')) {
        e.target.closest('.reminder-item').remove();
      }
    });
  }

  /**
   * Add a new reminder field
   */
  addReminder() {
    const remindersList = document.getElementById('reminders-list');
    if (!remindersList) return;

    const reminderItem = document.createElement('div');
    reminderItem.className = 'reminder-item';
    reminderItem.innerHTML = `
      <select class="ring reminder-time">
        <option value="0">At time of event</option>
        <option value="5">5 minutes before</option>
        <option value="15">15 minutes before</option>
        <option value="30">30 minutes before</option>
        <option value="60">1 hour before</option>
        <option value="1440">1 day before</option>
      </select>
      <button type="button" class="btn ghost btn-sm remove-reminder">Remove</button>
    `;
    remindersList.appendChild(reminderItem);
  }

  /**
   * Open modal for create or edit
   * @param {object} event - Existing event (null for new event)
   * @param {string} preselectedDate - ISO date string
   */
  openModal(event = null, preselectedDate = null) {
    console.log('📝 [EventModal] Opening modal:', { event, preselectedDate });
    
    this.currentEvent = event;
    this.editMode = !!event;

    // Update modal title
    const title = document.getElementById('event-modal-title');
    if (title) {
      title.textContent = this.editMode ? 'Edit Event' : 'Create Event';
    }

    // Reset or populate form
    if (this.editMode) {
      this.populateForm(event);
    } else {
      this.resetForm();
      if (preselectedDate) {
        const startDateField = document.getElementById('event-start-date');
        if (startDateField) {
          startDateField.value = preselectedDate.split('T')[0];
        }
      }
    }

    // Show modal
    this.modal.setAttribute('aria-hidden', 'false');
    this.modal.style.display = 'flex';
  }

  /**
   * Close modal
   */
  closeModal() {
    console.log('❌ [EventModal] Closing modal');
    this.modal.setAttribute('aria-hidden', 'true');
    this.modal.style.display = 'none';
    this.currentEvent = null;
    this.editMode = false;
    this.resetForm();
  }

  /**
   * Close another modal by name
   */
  closeOtherModal(modalName) {
    const otherModal = document.getElementById(`${modalName}-modal`);
    if (otherModal) {
      otherModal.setAttribute('aria-hidden', 'true');
      otherModal.style.display = 'none';
    }
  }

  /**
   * Reset form to default state
   */
  resetForm() {
    this.form.reset();
    document.getElementById('event-id').value = '';
    document.getElementById('recurrence-options').style.display = 'none';
    document.getElementById('conflict-warning').style.display = 'none';
    
    // Reset reminders to just one
    const remindersList = document.getElementById('reminders-list');
    if (remindersList) {
      remindersList.innerHTML = `
        <div class="reminder-item">
          <select class="ring reminder-time">
            <option value="0">At time of event</option>
            <option value="5">5 minutes before</option>
            <option value="15" selected>15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
          </select>
          <button type="button" class="btn ghost btn-sm remove-reminder">Remove</button>
        </div>
      `;
    }
  }

  /**
   * Populate form with existing event data
   * @param {object} event - Event data
   */
  populateForm(event) {
    console.log('📋 [EventModal] Populating form with event:', event);

    // Basic fields
    document.getElementById('event-id').value = event.id || '';
    document.getElementById('event-title').value = event.title || '';
    document.getElementById('event-description').value = event.description || '';
    
    // Dates and times
    if (event.startDate) {
      const startDate = new Date(event.startDate);
      document.getElementById('event-start-date').value = startDate.toISOString().split('T')[0];
      document.getElementById('event-start-time').value = 
        `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (event.endDate) {
      const endDate = new Date(event.endDate);
      document.getElementById('event-end-date').value = endDate.toISOString().split('T')[0];
      document.getElementById('event-end-time').value = 
        `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    }

    document.getElementById('event-all-day').checked = event.allDay || false;
    
    // Category and appearance
    document.getElementById('event-category').value = event.category || 'personal';
    if (event.color) document.getElementById('event-color').value = event.color;
    document.getElementById('event-priority').value = event.priority || 'medium';
    document.getElementById('event-privacy').value = event.privacy || 'public';
    
    // Location and tags
    document.getElementById('event-location').value = event.location || '';
    document.getElementById('event-tags').value = (event.tags || []).join(', ');
    
    // Attendees
    document.getElementById('event-attendees').value = (event.attendees || []).join(', ');
    
    // Recurrence
    if (event.isRecurring && event.recurrenceRule) {
      document.getElementById('event-recurring').checked = true;
      document.getElementById('recurrence-options').style.display = 'block';
      
      const rule = event.recurrenceRule;
      document.getElementById('recurrence-frequency').value = rule.frequency || 'daily';
      document.getElementById('recurrence-interval').value = rule.interval || 1;
      
      if (rule.until) {
        document.getElementById('recurrence-end-type').value = 'on';
        document.getElementById('recurrence-end-date-field').style.display = 'block';
        document.getElementById('recurrence-end-date').value = new Date(rule.until).toISOString().split('T')[0];
      } else if (rule.count) {
        document.getElementById('recurrence-end-type').value = 'after';
        document.getElementById('recurrence-count-field').style.display = 'block';
        document.getElementById('recurrence-count').value = rule.count;
      }
    }
    
    // OAuth sync
    document.getElementById('sync-to-google').checked = event.syncToGoogle || false;
    document.getElementById('sync-to-microsoft').checked = event.syncToMicrosoft || false;
  }

  /**
   * Collect form data and save event
   */
  async saveEvent() {
    console.log('💾 [EventModal] Saving event');

    // Validate required fields
    if (!this.form.checkValidity()) {
      this.form.reportValidity();
      return;
    }

    // Collect form data
    const eventData = this.collectFormData();

    try {
      let result;
      if (this.editMode) {
        console.log('✏️ [EventModal] Updating event:', eventData);
        result = await this.api.updateEvent(eventData);
      } else {
        console.log('➕ [EventModal] Creating event:', eventData);
        result = await this.api.createEvent(eventData);
      }

      if (result.success) {
        console.log('✅ [EventModal] Event saved successfully');
        this.closeModal();
        
        // Reload calendar data
        if (window.calendarInstance) {
          window.calendarInstance.loadMonthData(
            window.calendarInstance.currentDate.getFullYear(),
            window.calendarInstance.currentDate.getMonth() + 1
          );
        }
      } else {
        console.error('❌ [EventModal] Failed to save event:', result.error);
        alert(`Failed to save event: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ [EventModal] Error saving event:', error);
      alert(`Error saving event: ${error.message}`);
    }
  }

  /**
   * Collect all form data into event object
   * @returns {object} Event data
   */
  collectFormData() {
    const data = {
      title: document.getElementById('event-title').value,
      description: document.getElementById('event-description').value,
      category: document.getElementById('event-category').value,
      color: document.getElementById('event-color').value,
      priority: document.getElementById('event-priority').value,
      privacy: document.getElementById('event-privacy').value,
      location: document.getElementById('event-location').value,
      allDay: document.getElementById('event-all-day').checked,
      syncToGoogle: document.getElementById('sync-to-google').checked,
      syncToMicrosoft: document.getElementById('sync-to-microsoft').checked,
    };

    // Add ID if editing
    const eventId = document.getElementById('event-id').value;
    if (eventId) data.id = eventId;

    // Parse dates
    const startDate = document.getElementById('event-start-date').value;
    const startTime = document.getElementById('event-start-time').value;
    const endDate = document.getElementById('event-end-date').value;
    const endTime = document.getElementById('event-end-time').value;

    if (startDate) {
      data.startDate = startTime ? 
        new Date(`${startDate}T${startTime}`) : 
        new Date(startDate);
    }

    if (endDate) {
      data.endDate = endTime ? 
        new Date(`${endDate}T${endTime}`) : 
        new Date(endDate);
    }

    // Parse tags
    const tagsValue = document.getElementById('event-tags').value;
    if (tagsValue) {
      data.tags = tagsValue.split(',').map(t => t.trim()).filter(t => t);
    }

    // Parse attendees
    const attendeesValue = document.getElementById('event-attendees').value;
    if (attendeesValue) {
      data.attendees = attendeesValue.split(',').map(a => a.trim()).filter(a => a);
    }

    // Parse reminders
    data.reminders = [];
    document.querySelectorAll('.reminder-time').forEach(select => {
      const minutesBefore = parseInt(select.value);
      data.reminders.push({
        type: 'notification',
        minutesBefore: minutesBefore
      });
    });

    // Parse recurrence
    if (document.getElementById('event-recurring').checked) {
      data.isRecurring = true;
      data.recurrenceRule = {
        frequency: document.getElementById('recurrence-frequency').value,
        interval: parseInt(document.getElementById('recurrence-interval').value) || 1
      };

      const endType = document.getElementById('recurrence-end-type').value;
      if (endType === 'on') {
        const endDate = document.getElementById('recurrence-end-date').value;
        if (endDate) data.recurrenceRule.until = new Date(endDate);
      } else if (endType === 'after') {
        const count = document.getElementById('recurrence-count').value;
        if (count) data.recurrenceRule.count = parseInt(count);
      }
    }

    return data;
  }

  /**
   * Save current form data as a template
   */
  async saveAsTemplate() {
    const templateName = prompt('Enter a name for this template:');
    if (!templateName) return;

    const eventData = this.collectFormData();
    eventData.isTemplate = true;
    eventData.templateName = templateName;

    console.log('📋 [EventModal] Saving template:', templateName, eventData);
    // TODO: Implement template saving API
    alert('Template saved! (Feature coming soon)');
  }

  /**
   * View conflicting events
   */
  viewConflicts() {
    console.log('⚠️ [EventModal] Viewing conflicts');
    // TODO: Implement conflict viewing modal
    alert('Conflict viewer coming soon!');
  }
}

// Export for use in calendar.js
window.CalendarEventModal = CalendarEventModal;






