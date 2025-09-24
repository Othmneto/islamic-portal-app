// public/js/gamification/achievements.js
// Prayer Streak Gamification System

export class PrayerAchievements {
  constructor() {
    console.log("[Achievements] Initializing PrayerAchievements");
    this.achievements = this.defineAchievements();
    this.userAchievements = this.loadUserAchievements();
  }

  // Define all available achievements
  defineAchievements() {
    return {
      // Fajr Streak Achievements
      fajr_streak_3: {
        id: 'fajr_streak_3',
        name: 'Early Bird',
        description: 'Pray Fajr for 3 consecutive days',
        icon: '🌅',
        category: 'fajr',
        requirement: { type: 'fajr_streak', value: 3 },
        points: 50,
        rarity: 'common',
        color: '#FFD700'
      },
      fajr_streak_7: {
        id: 'fajr_streak_7',
        name: 'Dawn Warrior',
        description: 'Pray Fajr for 7 consecutive days',
        icon: '⚡',
        category: 'fajr',
        requirement: { type: 'fajr_streak', value: 7 },
        points: 100,
        rarity: 'uncommon',
        color: '#FF6B35'
      },
      fajr_streak_30: {
        id: 'fajr_streak_30',
        name: 'Fajr Master',
        description: 'Pray Fajr for 30 consecutive days',
        icon: '👑',
        category: 'fajr',
        requirement: { type: 'fajr_streak', value: 30 },
        points: 500,
        rarity: 'rare',
        color: '#8B5CF6'
      },

      // Perfect Day Achievements
      perfect_day_1: {
        id: 'perfect_day_1',
        name: 'Perfect Day',
        description: 'Pray all 5 prayers in one day',
        icon: '⭐',
        category: 'perfect',
        requirement: { type: 'perfect_day', value: 1 },
        points: 25,
        rarity: 'common',
        color: '#10B981'
      },
      perfect_week: {
        id: 'perfect_week',
        name: 'Perfect Week',
        description: 'Pray all 5 prayers for 7 consecutive days',
        icon: '🌟',
        category: 'perfect',
        requirement: { type: 'perfect_week', value: 7 },
        points: 200,
        rarity: 'rare',
        color: '#F59E0B'
      },
      perfect_month: {
        id: 'perfect_month',
        name: 'Perfect Month',
        description: 'Pray all 5 prayers for 30 consecutive days',
        icon: '💎',
        category: 'perfect',
        requirement: { type: 'perfect_month', value: 30 },
        points: 1000,
        rarity: 'legendary',
        color: '#EF4444'
      },

      // Consistency Achievements
      consistency_50: {
        id: 'consistency_50',
        name: 'Steady Progress',
        description: 'Maintain 50% prayer consistency for a month',
        icon: '📈',
        category: 'consistency',
        requirement: { type: 'consistency', value: 50, period: 30 },
        points: 75,
        rarity: 'common',
        color: '#3B82F6'
      },
      consistency_80: {
        id: 'consistency_80',
        name: 'Highly Consistent',
        description: 'Maintain 80% prayer consistency for a month',
        icon: '🎯',
        category: 'consistency',
        requirement: { type: 'consistency', value: 80, period: 30 },
        points: 150,
        rarity: 'uncommon',
        color: '#8B5CF6'
      },
      consistency_95: {
        id: 'consistency_95',
        name: 'Prayer Champion',
        description: 'Maintain 95% prayer consistency for a month',
        icon: '🏆',
        category: 'consistency',
        requirement: { type: 'consistency', value: 95, period: 30 },
        points: 300,
        rarity: 'rare',
        color: '#F59E0B'
      },

      // Milestone Achievements
      total_prayers_100: {
        id: 'total_prayers_100',
        name: 'Century Club',
        description: 'Complete 100 total prayers',
        icon: '💯',
        category: 'milestone',
        requirement: { type: 'total_prayers', value: 100 },
        points: 100,
        rarity: 'common',
        color: '#10B981'
      },
      total_prayers_500: {
        id: 'total_prayers_500',
        name: 'Half Millennium',
        description: 'Complete 500 total prayers',
        icon: '🔥',
        category: 'milestone',
        requirement: { type: 'total_prayers', value: 500 },
        points: 250,
        rarity: 'uncommon',
        color: '#F59E0B'
      },
      total_prayers_1000: {
        id: 'total_prayers_1000',
        name: 'Prayer Legend',
        description: 'Complete 1000 total prayers',
        icon: '👑',
        category: 'milestone',
        requirement: { type: 'total_prayers', value: 1000 },
        points: 500,
        rarity: 'legendary',
        color: '#8B5CF6'
      },

      // Special Achievements
      first_prayer: {
        id: 'first_prayer',
        name: 'First Steps',
        description: 'Log your first prayer',
        icon: '🌱',
        category: 'special',
        requirement: { type: 'first_prayer', value: 1 },
        points: 10,
        rarity: 'common',
        color: '#10B981'
      },
      comeback_kid: {
        id: 'comeback_kid',
        name: 'Comeback Kid',
        description: 'Return to praying after a 7-day break',
        icon: '🔄',
        category: 'special',
        requirement: { type: 'comeback', value: 7 },
        points: 50,
        rarity: 'uncommon',
        color: '#3B82F6'
      },
      night_owl: {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Pray Isha for 10 consecutive days',
        icon: '🦉',
        category: 'special',
        requirement: { type: 'isha_streak', value: 10 },
        points: 75,
        rarity: 'uncommon',
        color: '#6366F1'
      }
    };
  }

  // Load user's achievement progress from localStorage
  loadUserAchievements() {
    const stored = localStorage.getItem('prayer_achievements');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('[Achievements] Failed to parse stored achievements:', e);
      }
    }
    return {};
  }

  // Save user's achievement progress to localStorage
  saveUserAchievements() {
    localStorage.setItem('prayer_achievements', JSON.stringify(this.userAchievements));
  }

  // Get user's current progress for an achievement
  getProgress(achievementId) {
    return this.userAchievements[achievementId] || { unlocked: false, progress: 0, unlockedAt: null };
  }

  // Check if an achievement is unlocked
  isUnlocked(achievementId) {
    const progress = this.getProgress(achievementId);
    return progress.unlocked;
  }

  // Get all unlocked achievements
  getUnlockedAchievements() {
    return Object.keys(this.achievements).filter(id => this.isUnlocked(id));
  }

  // Get all locked achievements
  getLockedAchievements() {
    return Object.keys(this.achievements).filter(id => !this.isUnlocked(id));
  }

  // Get achievements by category
  getAchievementsByCategory(category) {
    return Object.values(this.achievements).filter(achievement => achievement.category === category);
  }

  // Calculate total points earned
  getTotalPoints() {
    return this.getUnlockedAchievements().reduce((total, id) => {
      return total + (this.achievements[id]?.points || 0);
    }, 0);
  }

  // Get user's level based on total points
  getUserLevel() {
    const points = this.getTotalPoints();
    if (points >= 2000) return { level: 10, name: 'Prayer Master', color: '#8B5CF6' };
    if (points >= 1500) return { level: 9, name: 'Spiritual Guide', color: '#F59E0B' };
    if (points >= 1200) return { level: 8, name: 'Devoted Servant', color: '#10B981' };
    if (points >= 1000) return { level: 7, name: 'Faithful Believer', color: '#3B82F6' };
    if (points >= 800) return { level: 6, name: 'Dedicated Worshipper', color: '#6366F1' };
    if (points >= 600) return { level: 5, name: 'Committed Muslim', color: '#8B5CF6' };
    if (points >= 400) return { level: 4, name: 'Regular Worshipper', color: '#F59E0B' };
    if (points >= 250) return { level: 3, name: 'Growing in Faith', color: '#10B981' };
    if (points >= 100) return { level: 2, name: 'Learning the Way', color: '#3B82F6' };
    return { level: 1, name: 'Beginning Journey', color: '#6B7280' };
  }

  // Check and update achievements based on prayer data
  checkAchievements(prayerData) {
    const newUnlocks = [];
    
    Object.keys(this.achievements).forEach(achievementId => {
      const achievement = this.achievements[achievementId];
      const currentProgress = this.getProgress(achievementId);
      
      if (currentProgress.unlocked) return; // Already unlocked
      
      const progress = this.calculateProgress(achievement, prayerData);
      const isUnlocked = progress >= achievement.requirement.value;
      
      if (isUnlocked) {
        this.userAchievements[achievementId] = {
          unlocked: true,
          progress: achievement.requirement.value,
          unlockedAt: new Date().toISOString()
        };
        newUnlocks.push(achievement);
        console.log(`[Achievements] 🎉 Unlocked: ${achievement.name}`);
      } else {
        this.userAchievements[achievementId] = {
          unlocked: false,
          progress: progress,
          unlockedAt: null
        };
      }
    });
    
    if (newUnlocks.length > 0) {
      this.saveUserAchievements();
    }
    
    return newUnlocks;
  }

  // Calculate progress for a specific achievement
  calculateProgress(achievement, prayerData) {
    const { type, value, period } = achievement.requirement;
    
    switch (type) {
      case 'fajr_streak':
        return this.calculateFajrStreak(prayerData);
      
      case 'perfect_day':
        return this.calculatePerfectDays(prayerData);
      
      case 'perfect_week':
        return this.calculatePerfectWeeks(prayerData);
      
      case 'perfect_month':
        return this.calculatePerfectMonths(prayerData);
      
      case 'consistency':
        return this.calculateConsistency(prayerData, period);
      
      case 'total_prayers':
        return this.calculateTotalPrayers(prayerData);
      
      case 'first_prayer':
        return this.calculateFirstPrayer(prayerData);
      
      case 'comeback':
        return this.calculateComeback(prayerData);
      
      case 'isha_streak':
        return this.calculateIshaStreak(prayerData);
      
      default:
        return 0;
    }
  }

  // Helper methods for calculating different achievement types
  calculateFajrStreak(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const today = new Date();
    let streak = 0;
    
    // Check consecutive days from today backwards
    for (let i = 0; i < 365; i++) { // Check up to a year
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = this.formatDateKey(checkDate);
      
      const dayPrayers = prayerData[dateKey] || [];
      if (dayPrayers.includes('fajr')) {
        streak++;
      } else {
        break; // Streak broken
      }
    }
    
    return streak;
  }

  calculatePerfectDays(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    let perfectDays = 0;
    Object.values(prayerData).forEach(dayPrayers => {
      if (Array.isArray(dayPrayers) && dayPrayers.length === 5) {
        perfectDays++;
      }
    });
    
    return perfectDays;
  }

  calculatePerfectWeeks(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const today = new Date();
    let perfectWeeks = 0;
    
    // Check consecutive weeks from today backwards
    for (let week = 0; week < 52; week++) { // Check up to a year
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (week * 7) - today.getDay());
      
      let weekPerfect = true;
      for (let day = 0; day < 7; day++) {
        const checkDate = new Date(weekStart);
        checkDate.setDate(weekStart.getDate() + day);
        const dateKey = this.formatDateKey(checkDate);
        
        const dayPrayers = prayerData[dateKey] || [];
        if (dayPrayers.length !== 5) {
          weekPerfect = false;
          break;
        }
      }
      
      if (weekPerfect) {
        perfectWeeks++;
      } else {
        break; // Perfect week streak broken
      }
    }
    
    return perfectWeeks;
  }

  calculatePerfectMonths(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const today = new Date();
    let perfectMonths = 0;
    
    // Check consecutive months from today backwards
    for (let month = 0; month < 12; month++) {
      const checkMonth = new Date(today);
      checkMonth.setMonth(today.getMonth() - month);
      
      let monthPerfect = true;
      const daysInMonth = new Date(checkMonth.getFullYear(), checkMonth.getMonth() + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const checkDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), day);
        const dateKey = this.formatDateKey(checkDate);
        
        const dayPrayers = prayerData[dateKey] || [];
        if (dayPrayers.length !== 5) {
          monthPerfect = false;
          break;
        }
      }
      
      if (monthPerfect) {
        perfectMonths++;
      } else {
        break; // Perfect month streak broken
      }
    }
    
    return perfectMonths;
  }

  calculateConsistency(prayerData, period) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - period);
    
    let totalDays = 0;
    let prayedDays = 0;
    
    for (let i = 0; i < period; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + i);
      const dateKey = this.formatDateKey(checkDate);
      
      totalDays++;
      const dayPrayers = prayerData[dateKey] || [];
      if (dayPrayers.length > 0) {
        prayedDays++;
      }
    }
    
    return totalDays > 0 ? Math.round((prayedDays / totalDays) * 100) : 0;
  }

  calculateTotalPrayers(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    let totalPrayers = 0;
    Object.values(prayerData).forEach(dayPrayers => {
      if (Array.isArray(dayPrayers)) {
        totalPrayers += dayPrayers.length;
      }
    });
    
    return totalPrayers;
  }

  calculateFirstPrayer(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const totalPrayers = this.calculateTotalPrayers(prayerData);
    return totalPrayers > 0 ? 1 : 0;
  }

  calculateComeback(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const today = new Date();
    let breakDays = 0;
    let comebackDays = 0;
    
    // Check for a 7-day break followed by return
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = this.formatDateKey(checkDate);
      
      const dayPrayers = prayerData[dateKey] || [];
      if (dayPrayers.length === 0) {
        breakDays++;
      } else {
        if (breakDays >= 7) {
          comebackDays++;
        }
        breakDays = 0;
      }
    }
    
    return comebackDays > 0 ? 1 : 0;
  }

  calculateIshaStreak(prayerData) {
    if (!prayerData || typeof prayerData !== 'object') return 0;
    
    const today = new Date();
    let streak = 0;
    
    // Check consecutive days from today backwards
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = this.formatDateKey(checkDate);
      
      const dayPrayers = prayerData[dateKey] || [];
      if (dayPrayers.includes('isha')) {
        streak++;
      } else {
        break; // Streak broken
      }
    }
    
    return streak;
  }

  // Helper method to format date as YYYY-MM-DD
  formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
