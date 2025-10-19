/* ------------------------------------------------------------------
   UI Components and modals
   - Assistant modal
   - Modal management
------------------------------------------------------------------- */

export class PrayerTimesUIComponents {
  constructor(core) {
    console.log("[UIComponents] Initializing PrayerTimesUIComponents");
    this.core = core;
  }


  // Setup assistant modal
  setupAssistantModal() {
    this.core.el.openAssistantBtn?.addEventListener("click", () => {
      this.core.el.assistantModal?.classList.add("active");
      this.core.el.assistantModal?.setAttribute("aria-hidden", "false");
      document.body.setAttribute("inert", "");
    });

    this.core.el.closeAssistantBtn?.addEventListener("click", () => {
      this.core.el.assistantModal?.classList.remove("active");
      this.core.el.assistantModal?.setAttribute("aria-hidden", "true");
      document.body.removeAttribute("inert");
    });

    this.core.el.assistantSendBtn?.addEventListener("click", () => {
      const input = this.core.el.assistantInput;
      if (!input || !input.value.trim()) return;
      const userDiv = document.createElement("div");
      userDiv.className = "message user";
      userDiv.textContent = input.value.trim();
      this.core.el.assistantChatWindow?.appendChild(userDiv);
      input.value = "";
    });
  }

  // Setup UI event listeners
  setupEventListeners() {
    this.setupAssistantModal();
  }

  // Initialize UI components
  initialize() {
    this.setupEventListeners();
  }
}
