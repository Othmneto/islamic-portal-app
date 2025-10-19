// Comprehensive Security Monitoring Service
const mongoose = require('mongoose');

// Security Event Schema
const securityEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'REGISTRATION_SUCCESS',
      'REGISTRATION_FAILED',
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_SUCCESS',
      'PASSWORD_RESET_FAILED',
      'ACCOUNT_LOCKED',
      'ACCOUNT_UNLOCKED',
      'RATE_LIMIT_EXCEEDED',
      'CSRF_VIOLATION',
      'XSS_ATTEMPT',
      'SQL_INJECTION_ATTEMPT',
      'UNAUTHORIZED_ACCESS',
      'SUSPICIOUS_ACTIVITY',
      'TOKEN_BLACKLISTED',
      'EMAIL_VERIFICATION_SENT',
      'EMAIL_VERIFICATION_SUCCESS',
      'EMAIL_VERIFICATION_FAILED',
      'OAUTH_LOGIN_SUCCESS',
      'OAUTH_LOGIN_FAILED',
      'SESSION_EXPIRED',
      'SESSION_HIJACK_ATTEMPT',
      'BRUTE_FORCE_ATTEMPT',
      'CREDENTIAL_STUFFING_ATTEMPT',
      // MFA Events
      'MFA_ENABLED',
      'MFA_DISABLED',
      'MFA_VERIFICATION_SUCCESS',
      'MFA_VERIFICATION_FAILED',
      'TOTP_GENERATED',
      'TOTP_VERIFIED',
      'TOTP_ENABLED',
      'TOTP_DISABLED',
      'EMAIL_MFA_CODE_SENT',
      'EMAIL_MFA_VERIFIED',
      'EMAIL_MFA_ENABLED',
      'EMAIL_MFA_DISABLED',
      'BACKUP_CODES_GENERATED',
      'BACKUP_CODE_USED',
      'MFA_SETUP_STARTED',
      'EMAIL_NOTIFICATIONS_TOGGLED',
      'MFA_SETUP_COMPLETED',
      'PASSWORD_VERIFIED',
      'INVALID_PASSWORD_ATTEMPT',
      'BIOMETRIC_AUTH_ENABLED',
      'BIOMETRIC_AUTH_DISABLED',
      'PROFILE_VIEWED',
      'PROFILE_UPDATED',
      'AVATAR_UPLOADED',
      'PREFERENCES_UPDATED',
      'PASSWORD_CHANGED',
      'DATA_EXPORTED',
      'ACCOUNT_DELETED',
      'PRIVACY_SETTINGS_UPDATED',
      'TRANSLATION_HISTORY_CLEARED',
      'REMEMBER_ME_SETTINGS_UPDATED',
      'TRUSTED_DEVICE_REVOKED'
    ]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  requestDetails: {
    method: String,
    url: String,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: String,
  resolution: String
}, {
  timestamps: true
});

// Indexes for performance
securityEventSchema.index({ eventType: 1, timestamp: -1 });
securityEventSchema.index({ ipAddress: 1, timestamp: -1 });
securityEventSchema.index({ userId: 1, timestamp: -1 });
securityEventSchema.index({ riskScore: -1, timestamp: -1 });
securityEventSchema.index({ severity: 1, timestamp: -1 });
securityEventSchema.index({ resolved: 1, timestamp: -1 });

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

// Security Monitor Class
class SecurityMonitor {
  constructor() {
    this.riskThresholds = {
      LOW: 0,
      MEDIUM: 30,
      HIGH: 60,
      CRITICAL: 80
    };
    this.alertChannels = [];
    this.isMonitoring = false;
  }

  // Start monitoring
  start() {
    if (this.isMonitoring) {
      console.log('🔍 Security monitoring already active');
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 Security monitoring started');

    // Set up periodic risk analysis
    this.riskAnalysisInterval = setInterval(() => {
      this.analyzeRiskPatterns();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Set up cleanup of old events
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEvents();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  // Stop monitoring
  stop() {
    this.isMonitoring = false;
    if (this.riskAnalysisInterval) {
      clearInterval(this.riskAnalysisInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log('🔍 Security monitoring stopped');
  }

  // Log security event
  async logEvent(eventData) {
    try {
      const event = new SecurityEvent(eventData);
      await event.save();

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(event);
      event.riskScore = riskScore;
      event.severity = this.getSeverityLevel(riskScore);
      await event.save();

      // Check for immediate alerts
      if (riskScore >= this.riskThresholds.HIGH) {
        await this.triggerAlert(event);
      }

      console.log(`🔍 Security event logged: ${event.eventType} (Risk: ${riskScore})`);
      return event;
    } catch (error) {
      console.error('❌ Failed to log security event:', error);
      throw error;
    }
  }

  // Calculate risk score based on event patterns
  async calculateRiskScore(event) {
    let riskScore = 0;

    // Base risk scores by event type
    const baseScores = {
      'LOGIN_SUCCESS': 0,
      'LOGIN_FAILED': 20,
      'REGISTRATION_SUCCESS': 5,
      'REGISTRATION_FAILED': 15,
      'PASSWORD_RESET_REQUEST': 10,
      'PASSWORD_RESET_SUCCESS': 5,
      'PASSWORD_RESET_FAILED': 25,
      'ACCOUNT_LOCKED': 40,
      'ACCOUNT_UNLOCKED': 10,
      'RATE_LIMIT_EXCEEDED': 30,
      'CSRF_VIOLATION': 50,
      'XSS_ATTEMPT': 60,
      'SQL_INJECTION_ATTEMPT': 70,
      'UNAUTHORIZED_ACCESS': 80,
      'SUSPICIOUS_ACTIVITY': 45,
      'TOKEN_BLACKLISTED': 20,
      'EMAIL_VERIFICATION_SENT': 5,
      'EMAIL_VERIFICATION_SUCCESS': 0,
      'EMAIL_VERIFICATION_FAILED': 15,
      'OAUTH_LOGIN_SUCCESS': 5,
      'OAUTH_LOGIN_FAILED': 20,
      'SESSION_EXPIRED': 10,
      'SESSION_HIJACK_ATTEMPT': 90,
      'BRUTE_FORCE_ATTEMPT': 85,
      'CREDENTIAL_STUFFING_ATTEMPT': 95
    };

    riskScore = baseScores[event.eventType] || 10;

    // Check for patterns that increase risk
    const recentEvents = await SecurityEvent.find({
      $or: [
        { ipAddress: event.ipAddress },
        { userId: event.userId }
      ],
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).sort({ timestamp: -1 }).limit(10);

    // Multiple failed attempts from same IP
    const failedAttempts = recentEvents.filter(e =>
      e.eventType.includes('FAILED') || e.eventType.includes('VIOLATION')
    ).length;
    riskScore += failedAttempts * 10;

    // Multiple different user agents from same IP
    const uniqueUserAgents = new Set(recentEvents.map(e => e.userAgent)).size;
    if (uniqueUserAgents > 3) {
      riskScore += 20;
    }

    // Rapid succession of events
    if (recentEvents.length > 5) {
      riskScore += 15;
    }

    // Geographic anomalies (if location data available)
    if (event.location && event.location.coordinates) {
      const recentLocations = recentEvents
        .filter(e => e.location && e.location.coordinates)
        .map(e => e.location.coordinates);

      if (recentLocations.length > 0) {
        const distance = this.calculateDistance(
          event.location.coordinates,
          recentLocations[0]
        );

        if (distance > 1000) { // More than 1000km
          riskScore += 25;
        }
      }
    }

    return Math.min(riskScore, 100);
  }

  // Get severity level based on risk score
  getSeverityLevel(riskScore) {
    if (riskScore >= this.riskThresholds.CRITICAL) return 'CRITICAL';
    if (riskScore >= this.riskThresholds.HIGH) return 'HIGH';
    if (riskScore >= this.riskThresholds.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  // Trigger alert for high-risk events
  async triggerAlert(event) {
    console.log(`🚨 HIGH RISK ALERT: ${event.eventType} (Score: ${event.riskScore})`);
    console.log(`📍 IP: ${event.ipAddress}, User: ${event.userId || 'Anonymous'}`);
    console.log(`🕐 Time: ${event.timestamp}`);

    // Here you could integrate with external alerting systems
    // - Send email notifications
    // - Send Slack/Discord messages
    // - Trigger webhooks
    // - Send SMS alerts
  }

  // Analyze risk patterns
  async analyzeRiskPatterns() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find high-risk events in the last hour
      const highRiskEvents = await SecurityEvent.find({
        riskScore: { $gte: this.riskThresholds.HIGH },
        timestamp: { $gte: oneHourAgo },
        resolved: false
      });

      if (highRiskEvents.length > 0) {
        console.log(`🔍 Found ${highRiskEvents.length} high-risk events in the last hour`);

        // Group by IP address
        const ipGroups = {};
        highRiskEvents.forEach(event => {
          if (!ipGroups[event.ipAddress]) {
            ipGroups[event.ipAddress] = [];
          }
          ipGroups[event.ipAddress].push(event);
        });

        // Check for coordinated attacks
        Object.entries(ipGroups).forEach(([ip, events]) => {
          if (events.length >= 5) {
            console.log(`🚨 Potential coordinated attack from IP: ${ip} (${events.length} events)`);
          }
        });
      }
    } catch (error) {
      console.error('❌ Error analyzing risk patterns:', error);
    }
  }

  // Cleanup old events (keep last 30 days)
  async cleanupOldEvents() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await SecurityEvent.deleteMany({
        timestamp: { $lt: thirtyDaysAgo },
        severity: { $in: ['LOW', 'MEDIUM'] } // Keep high and critical events longer
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old security events`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old events:', error);
    }
  }

  // Get security dashboard data
  async getDashboardData(timeframe = '24h') {
    try {
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const startTime = new Date(Date.now() - timeframes[timeframe] || timeframes['24h']);

      const events = await SecurityEvent.find({
        timestamp: { $gte: startTime }
      });

      const stats = {
        totalEvents: events.length,
        byType: {},
        bySeverity: {},
        byHour: {},
        topIPs: {},
        riskTrend: []
      };

      events.forEach(event => {
        // Count by type
        stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1;

        // Count by severity
        stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;

        // Count by hour
        const hour = new Date(event.timestamp).getHours();
        stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

        // Count by IP
        stats.topIPs[event.ipAddress] = (stats.topIPs[event.ipAddress] || 0) + 1;
      });

      // Calculate risk trend (last 24 hours)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hourlyEvents = await SecurityEvent.find({
        timestamp: { $gte: last24Hours }
      }).sort({ timestamp: 1 });

      const hourlyRisk = {};
      hourlyEvents.forEach(event => {
        const hour = new Date(event.timestamp).getHours();
        if (!hourlyRisk[hour]) {
          hourlyRisk[hour] = { count: 0, totalRisk: 0 };
        }
        hourlyRisk[hour].count++;
        hourlyRisk[hour].totalRisk += event.riskScore;
      });

      stats.riskTrend = Object.entries(hourlyRisk).map(([hour, data]) => ({
        hour: parseInt(hour),
        count: data.count,
        avgRisk: data.totalRisk / data.count
      }));

      return stats;
    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      throw error;
    }
  }

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(coord2.lat - coord1.lat);
    const dLon = this.toRad(coord2.lng - coord1.lng);
    const lat1 = this.toRad(coord1.lat);
    const lat2 = this.toRad(coord2.lat);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI/180);
  }
}

// Create singleton instance
const securityMonitor = new SecurityMonitor();

module.exports = {
  SecurityEvent,
  securityMonitor
};