// Security Dashboard API Routes
const express = require('express');
const router = express.Router();
const { securityMonitor, SecurityEvent } = require('../services/securityMonitor');
const authMiddleware = require('../middleware/auth');

// Get security dashboard data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const dashboardData = await securityMonitor.getDashboardData(timeframe);
    
    res.json({
      success: true,
      data: dashboardData,
      timeframe,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting security dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security dashboard data'
    });
  }
});

// Get recent security events
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      eventType, 
      severity, 
      timeframe = '24h' 
    } = req.query;

    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(Date.now() - (timeframes[timeframe] || timeframes['24h']));
    
    const query = {
      timestamp: { $gte: startTime }
    };

    if (eventType) {
      query.eventType = eventType;
    }

    if (severity) {
      query.severity = severity;
    }

    const events = await SecurityEvent.find(query)
      .populate('userId', 'email username')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SecurityEvent.countDocuments(query);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting security events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security events'
    });
  }
});

// Get security statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(Date.now() - (timeframes[timeframe] || timeframes['24h']));
    
    // Get basic statistics
    const totalEvents = await SecurityEvent.countDocuments({
      timestamp: { $gte: startTime }
    });

    const highRiskEvents = await SecurityEvent.countDocuments({
      timestamp: { $gte: startTime },
      severity: { $in: ['HIGH', 'CRITICAL'] }
    });

    const uniqueIPs = await SecurityEvent.distinct('ipAddress', {
      timestamp: { $gte: startTime }
    });

    const topEventTypes = await SecurityEvent.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topIPs = await SecurityEvent.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      { $group: { _id: '$ipAddress', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const severityDistribution = await SecurityEvent.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        highRiskEvents,
        uniqueIPs: uniqueIPs.length,
        topEventTypes,
        topIPs,
        severityDistribution,
        timeframe,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting security statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security statistics'
    });
  }
});

// Get risk analysis
router.get('/risk-analysis', authMiddleware, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(Date.now() - (timeframes[timeframe] || timeframes['24h']));
    
    // Get high-risk events
    const highRiskEvents = await SecurityEvent.find({
      timestamp: { $gte: startTime },
      riskScore: { $gte: 60 }
    }).sort({ riskScore: -1 }).limit(20);

    // Get suspicious IPs
    const suspiciousIPs = await SecurityEvent.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      { $group: { 
        _id: '$ipAddress', 
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        maxRiskScore: { $max: '$riskScore' },
        eventTypes: { $addToSet: '$eventType' }
      }},
      { $match: { 
        $or: [
          { count: { $gte: 5 } },
          { avgRiskScore: { $gte: 50 } },
          { maxRiskScore: { $gte: 80 } }
        ]
      }},
      { $sort: { maxRiskScore: -1 } },
      { $limit: 10 }
    ]);

    // Get geographic analysis (if location data available)
    const geographicAnalysis = await SecurityEvent.aggregate([
      { 
        $match: { 
          timestamp: { $gte: startTime },
          'location.country': { $exists: true }
        } 
      },
      { $group: { 
        _id: '$location.country', 
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        highRiskEvents,
        suspiciousIPs,
        geographicAnalysis,
        timeframe,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting risk analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve risk analysis'
    });
  }
});

// Resolve security event
router.post('/events/:eventId/resolve', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { resolution, resolvedBy = req.user.email } = req.body;

    const event = await SecurityEvent.findByIdAndUpdate(
      eventId,
      {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolution
      },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Security event not found'
      });
    }

    res.json({
      success: true,
      data: event,
      message: 'Security event resolved successfully'
    });
  } catch (error) {
    console.error('❌ Error resolving security event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve security event'
    });
  }
});

// Get security alerts
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const { resolved = false } = req.query;
    
    const alerts = await SecurityEvent.find({
      resolved: resolved === 'true',
      severity: { $in: ['HIGH', 'CRITICAL'] }
    })
    .populate('userId', 'email username')
    .sort({ timestamp: -1 })
    .limit(50);

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('❌ Error getting security alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security alerts'
    });
  }
});

module.exports = router;
