// public/js/gamification/gamification-ui.js
// UI Components for Prayer Streak Gamification

export class GamificationUI {
  constructor(achievements) {
    console.log("[GamificationUI] Initializing GamificationUI");
    this.achievements = achievements;
    this.animationQueue = [];
  }

  // Create the main gamification dashboard section
  createGamificationSection() {
    const section = document.createElement('section');
    section.className = 'gamification-section';
    section.innerHTML = `
      <div class="gamification-header">
        <h2><i class="fas fa-trophy"></i> Prayer Achievements</h2>
        <div class="user-level">
          <div class="level-badge" id="user-level-badge">
            <span class="level-number" id="user-level-number">1</span>
            <span class="level-name" id="user-level-name">Beginning Journey</span>
          </div>
          <div class="level-progress">
            <div class="progress-bar">
              <div class="progress-fill" id="level-progress-fill"></div>
            </div>
            <span class="progress-text" id="level-progress-text">0 / 100 points</span>
          </div>
        </div>
      </div>
      
      <div class="achievements-grid" id="achievements-grid">
        <!-- Achievements will be populated here -->
      </div>
      
      <div class="achievement-categories">
        <button class="category-btn active" data-category="all">All</button>
        <button class="category-btn" data-category="fajr">Fajr</button>
        <button class="category-btn" data-category="perfect">Perfect</button>
        <button class="category-btn" data-category="consistency">Consistency</button>
        <button class="category-btn" data-category="milestone">Milestones</button>
        <button class="category-btn" data-category="special">Special</button>
      </div>
    `;

    return section;
  }

  // Render all achievements in the grid
  renderAchievements(category = 'all') {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    const achievements = category === 'all'
      ? Object.values(this.achievements.achievements)
      : this.achievements.getAchievementsByCategory(category);

    grid.innerHTML = achievements.map(achievement => {
      const progress = this.achievements.getProgress(achievement.id);
      const isUnlocked = progress.unlocked;
      const progressPercent = achievement.requirement.value > 0
        ? Math.min((progress.progress / achievement.requirement.value) * 100, 100)
        : 0;

      return `
        <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}" data-achievement-id="${achievement.id}">
          <div class="achievement-icon">
            <span class="icon">${achievement.icon}</span>
            ${isUnlocked ? '<div class="unlock-badge">✓</div>' : ''}
          </div>
          <div class="achievement-content">
            <h3 class="achievement-name">${achievement.name}</h3>
            <p class="achievement-description">${achievement.description}</p>
            <div class="achievement-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercent}%"></div>
              </div>
              <span class="progress-text">${progress.progress} / ${achievement.requirement.value}</span>
            </div>
            <div class="achievement-meta">
              <span class="achievement-points">${achievement.points} pts</span>
              <span class="achievement-rarity ${achievement.rarity}">${achievement.rarity}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers for achievement cards
    this.addAchievementClickHandlers();
  }

  // Add click handlers to achievement cards
  addAchievementClickHandlers() {
    document.querySelectorAll('.achievement-card').forEach(card => {
      card.addEventListener('click', () => {
        const achievementId = card.dataset.achievementId;
        this.showAchievementDetails(achievementId);
      });
    });
  }

  // Show detailed view of an achievement
  showAchievementDetails(achievementId) {
    const achievement = this.achievements.achievements[achievementId];
    const progress = this.achievements.getProgress(achievementId);

    if (!achievement) return;

    const modal = document.createElement('div');
    modal.className = 'achievement-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${achievement.name}</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="achievement-icon-large">
            <span class="icon">${achievement.icon}</span>
            ${progress.unlocked ? '<div class="unlock-badge-large">✓</div>' : ''}
          </div>
          <p class="achievement-description-large">${achievement.description}</p>
          <div class="achievement-progress-large">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(progress.progress / achievement.requirement.value) * 100}%"></div>
            </div>
            <span class="progress-text">${progress.progress} / ${achievement.requirement.value}</span>
          </div>
          <div class="achievement-meta-large">
            <div class="meta-item">
              <span class="label">Points:</span>
              <span class="value">${achievement.points}</span>
            </div>
            <div class="meta-item">
              <span class="label">Rarity:</span>
              <span class="value rarity ${achievement.rarity}">${achievement.rarity}</span>
            </div>
            ${progress.unlocked ? `
              <div class="meta-item">
                <span class="label">Unlocked:</span>
                <span class="value">${new Date(progress.unlockedAt).toLocaleDateString()}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add close functionality
    modal.querySelector('.close-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // Update user level display
  updateUserLevel() {
    const level = this.achievements.getUserLevel();
    const totalPoints = this.achievements.getTotalPoints();

    const levelNumber = document.getElementById('user-level-number');
    const levelName = document.getElementById('user-level-name');
    const progressFill = document.getElementById('level-progress-fill');
    const progressText = document.getElementById('level-progress-text');

    if (levelNumber) levelNumber.textContent = level.level;
    if (levelName) levelName.textContent = level.name;
    if (progressFill) progressFill.style.backgroundColor = level.color;
    if (progressText) progressText.textContent = `${totalPoints} points`;

    // Calculate progress to next level
    const pointsForCurrentLevel = this.getPointsForLevel(level.level);
    const pointsForNextLevel = this.getPointsForLevel(level.level + 1);
    const progressPercent = ((totalPoints - pointsForCurrentLevel) / (pointsForNextLevel - pointsForCurrentLevel)) * 100;

    if (progressFill) progressFill.style.width = `${Math.min(progressPercent, 100)}%`;
  }

  // Get points required for a specific level
  getPointsForLevel(level) {
    const levelThresholds = [0, 100, 250, 400, 600, 800, 1000, 1200, 1500, 2000];
    return levelThresholds[level - 1] || 2000;
  }

  // Show achievement unlock animation
  showAchievementUnlock(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <div class="achievement-icon">
          <span class="icon">${achievement.icon}</span>
          <div class="sparkle"></div>
        </div>
        <div class="notification-text">
          <h3>Achievement Unlocked!</h3>
          <p>${achievement.name}</p>
          <span class="points">+${achievement.points} points</span>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // Remove after animation
    setTimeout(() => {
      notification.classList.add('hide');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Add category filter functionality
  addCategoryFilters() {
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active class from all buttons
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');

        // Filter achievements
        const category = btn.dataset.category;
        this.renderAchievements(category);
      });
    });
  }

  // Initialize the gamification UI
  initialize() {
    console.log("[GamificationUI] Initializing UI components");

    // Update user level
    this.updateUserLevel();

    // Render achievements
    this.renderAchievements();

    // Add category filters
    this.addCategoryFilters();

    console.log("[GamificationUI] UI components initialized");
  }

  // Update achievements when new prayer data is available
  updateAchievements(prayerData) {
    console.log("[GamificationUI] Updating achievements with new prayer data");

    const newUnlocks = this.achievements.checkAchievements(prayerData);

    // Show unlock animations for new achievements
    newUnlocks.forEach(achievement => {
      this.showAchievementUnlock(achievement);
    });

    // Update UI
    this.updateUserLevel();
    this.renderAchievements();
  }
}
