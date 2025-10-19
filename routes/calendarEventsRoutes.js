const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get all events for the authenticated user
router.get('/events', requireAuth, async (req, res) => {
    try {
        console.log('📅 [Calendar Events] Fetching events for user:', req.user.id);

        // Get user's events from their profile
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get events from user's calendar data
        const events = user.calendarEvents || [];

        console.log('📅 [Calendar Events] Found', events.length, 'events for user');

        res.json({
            success: true,
            events: events,
            count: events.length
        });

    } catch (error) {
        console.error('❌ [Calendar Events] Error fetching events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch events'
        });
    }
});

// Create a new event or save all events
router.post('/events', requireAuth, async (req, res) => {
    try {
        console.log('📅 [Calendar Events] Processing event request for user:', req.user.id);

        // Check if this is a bulk save operation
        if (req.body.events && Array.isArray(req.body.events)) {
            console.log('📅 [Calendar Events] Bulk saving events:', req.body.events.length);

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Replace all events with the new ones
            user.calendarEvents = req.body.events.map(event => ({
                ...event,
                startDate: new Date(event.startDate),
                endDate: event.endDate ? new Date(event.endDate) : null,
                updatedAt: new Date()
            }));

            // Handle version conflicts
            try {
                await user.save();
            } catch (versionError) {
                if (versionError.name === 'VersionError') {
                    console.log('🔄 [Calendar Events] Version conflict detected, retrying with fresh user data...');
                    // Fetch fresh user data and retry
                    const freshUser = await User.findById(req.user.id);
                    if (freshUser) {
                        freshUser.calendarEvents = req.body.events.map(event => ({
                            ...event,
                            startDate: new Date(event.startDate),
                            endDate: event.endDate ? new Date(event.endDate) : null,
                            updatedAt: new Date()
                        }));
                        await freshUser.save();
                        console.log('✅ [Calendar Events] Version conflict resolved with fresh data');
                    } else {
                        throw new Error('User not found after version conflict');
                    }
                } else {
                    throw versionError;
                }
            }

            console.log('✅ [Calendar Events] Bulk save completed:', user.calendarEvents.length, 'events');

            // Trigger automatic sync to Google Calendar (debounced)
            try {
                const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
                setTimeout(async () => {
                    try {
                        const syncResult = await oauthCalendarSyncService.syncLocalEventsToGoogle(user);
                        console.log('🔄 [Calendar Events] Auto-sync to Google completed:', syncResult);
                    } catch (syncError) {
                        console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
                    }
                }, 1000);
            } catch (syncError) {
                console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
            }

            // Trigger automatic sync to Microsoft Calendar (debounced)
            try {
                const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
                setTimeout(async () => {
                    try {
                        const syncResult = await oauthCalendarSyncService.syncLocalEventsToMicrosoft(user);
                        console.log('🔄 [Calendar Events] Auto-sync to Microsoft completed:', syncResult);
                    } catch (syncError) {
                        console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
                    }
                }, 1500);
            } catch (syncError) {
                console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
            }

            res.json({
                success: true,
                events: user.calendarEvents,
                count: user.calendarEvents.length,
                message: 'Events saved successfully'
            });

        } else {
            // Single event creation
            const { title, description, startDate, endDate, category, priority, location, tags, isIslamicEvent, prayerTime } = req.body;

            // Validate required fields
            if (!title || !startDate) {
                return res.status(400).json({
                    success: false,
                    error: 'Title and start date are required'
                });
            }

            // Create new event
            const newEvent = {
                id: Date.now().toString(),
                title,
                description: description || '',
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                category: category || 'personal',
                priority: priority || 'medium',
                location: location || '',
                tags: tags || [],
                isIslamicEvent: isIslamicEvent || false,
                prayerTime: prayerTime || null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Add event to user's calendar
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            if (!user.calendarEvents) {
                user.calendarEvents = [];
            }

            user.calendarEvents.push(newEvent);

            // Handle version conflicts
            try {
                await user.save();
            } catch (versionError) {
                if (versionError.name === 'VersionError') {
                    console.log('🔄 [Calendar Events] Version conflict detected, retrying with fresh user data...');
                    // Fetch fresh user data and retry
                    const freshUser = await User.findById(req.user.id);
                    if (freshUser) {
                        if (!freshUser.calendarEvents) {
                            freshUser.calendarEvents = [];
                        }
                        freshUser.calendarEvents.push(newEvent);
                        await freshUser.save();
                        console.log('✅ [Calendar Events] Version conflict resolved with fresh data');
                    } else {
                        throw new Error('User not found after version conflict');
                    }
                } else {
                    throw versionError;
                }
            }

            console.log('✅ [Calendar Events] Event created:', newEvent.id);

            // Trigger automatic sync to Google Calendar (debounced)
            try {
                const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
                setTimeout(async () => {
                    try {
                        const syncResult = await oauthCalendarSyncService.syncLocalEventsToGoogle(user);
                        console.log('🔄 [Calendar Events] Auto-sync to Google completed:', syncResult);
                    } catch (syncError) {
                        console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
                    }
                }, 1000);
            } catch (syncError) {
                console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
            }

            // Trigger automatic sync to Microsoft Calendar (debounced)
            try {
                const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
                setTimeout(async () => {
                    try {
                        const syncResult = await oauthCalendarSyncService.syncLocalEventsToMicrosoft(user);
                        console.log('🔄 [Calendar Events] Auto-sync to Microsoft completed:', syncResult);
                    } catch (syncError) {
                        console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
                    }
                }, 1500);
            } catch (syncError) {
                console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
            }

            res.json({
                success: true,
                event: newEvent,
                message: 'Event created successfully'
            });
        }

    } catch (error) {
        console.error('❌ [Calendar Events] Error processing event request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process event request'
        });
    }
});

// Update an existing event
router.put('/events/:eventId', requireAuth, async (req, res) => {
    try {
        console.log('📅 [Calendar Events] Updating event:', req.params.eventId);

        const { eventId } = req.params;
        const updateData = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const eventIndex = user.calendarEvents.findIndex(event => event.id === eventId);
        if (eventIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Event not found'
            });
        }

        // Update event
        user.calendarEvents[eventIndex] = {
            ...user.calendarEvents[eventIndex],
            ...updateData,
            updatedAt: new Date()
        };

        // Handle version conflicts
        try {
            await user.save();
        } catch (versionError) {
            if (versionError.name === 'VersionError') {
                console.log('🔄 [Calendar Events] Version conflict detected, retrying with fresh user data...');
                // Fetch fresh user data and retry
                const freshUser = await User.findById(req.user.id);
                if (freshUser) {
                    const freshEventIndex = freshUser.calendarEvents.findIndex(event => event.id === eventId);
                    if (freshEventIndex !== -1) {
                        freshUser.calendarEvents[freshEventIndex] = {
                            ...freshUser.calendarEvents[freshEventIndex],
                            ...updateData,
                            updatedAt: new Date()
                        };
                        await freshUser.save();
                        console.log('✅ [Calendar Events] Version conflict resolved with fresh data');
                    } else {
                        throw new Error('Event not found after version conflict');
                    }
                } else {
                    throw new Error('User not found after version conflict');
                }
            } else {
                throw versionError;
            }
        }

        console.log('✅ [Calendar Events] Event updated:', eventId);

        // Trigger automatic sync to Google Calendar (debounced)
        try {
            const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
            setTimeout(async () => {
                try {
                    const syncResult = await oauthCalendarSyncService.syncLocalEventsToGoogle(user);
                    console.log('🔄 [Calendar Events] Auto-sync to Google completed:', syncResult);
                } catch (syncError) {
                    console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
                }
            }, 1000);
        } catch (syncError) {
            console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
        }

        // Trigger automatic sync to Microsoft Calendar (debounced)
        try {
            const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
            setTimeout(async () => {
                try {
                    const syncResult = await oauthCalendarSyncService.syncLocalEventsToMicrosoft(user);
                    console.log('🔄 [Calendar Events] Auto-sync to Microsoft completed:', syncResult);
                } catch (syncError) {
                    console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
                }
            }, 1500);
        } catch (syncError) {
            console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
        }

        res.json({
            success: true,
            event: user.calendarEvents[eventIndex],
            message: 'Event updated successfully'
        });

    } catch (error) {
        console.error('❌ [Calendar Events] Error updating event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update event'
        });
    }
});

// Delete an event
router.delete('/events/:eventId', requireAuth, async (req, res) => {
    try {
        console.log('📅 [Calendar Events] Deleting event:', req.params.eventId);

        const { eventId } = req.params;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const eventIndex = user.calendarEvents.findIndex(event => event.id === eventId);
        if (eventIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Event not found'
            });
        }

        // Remove event
        user.calendarEvents.splice(eventIndex, 1);

        // Handle version conflicts
        try {
            await user.save();
        } catch (versionError) {
            if (versionError.name === 'VersionError') {
                console.log('🔄 [Calendar Events] Version conflict detected, retrying with fresh user data...');
                // Fetch fresh user data and retry
                const freshUser = await User.findById(req.user.id);
                if (freshUser) {
                    const freshEventIndex = freshUser.calendarEvents.findIndex(event => event.id === eventId);
                    if (freshEventIndex !== -1) {
                        freshUser.calendarEvents.splice(freshEventIndex, 1);
                        await freshUser.save();
                        console.log('✅ [Calendar Events] Version conflict resolved with fresh data');
                    } else {
                        throw new Error('Event not found after version conflict');
                    }
                } else {
                    throw new Error('User not found after version conflict');
                }
            } else {
                throw versionError;
            }
        }

        console.log('✅ [Calendar Events] Event deleted:', eventId);

        // Trigger automatic sync to Google Calendar (debounced)
        try {
            const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
            setTimeout(async () => {
                try {
                    const syncResult = await oauthCalendarSyncService.syncLocalEventsToGoogle(user);
                    console.log('🔄 [Calendar Events] Auto-sync to Google completed:', syncResult);
                } catch (syncError) {
                    console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
                }
            }, 1000);
        } catch (syncError) {
            console.log('⚠️ [Calendar Events] Auto-sync to Google failed:', syncError.message);
        }

        // Trigger automatic sync to Microsoft Calendar (debounced)
        try {
            const oauthCalendarSyncService = require('../services/oauthCalendarSyncService');
            setTimeout(async () => {
                try {
                    const syncResult = await oauthCalendarSyncService.syncLocalEventsToMicrosoft(user);
                    console.log('🔄 [Calendar Events] Auto-sync to Microsoft completed:', syncResult);
                } catch (syncError) {
                    console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
                }
            }, 1500);
        } catch (syncError) {
            console.log('⚠️ [Calendar Events] Auto-sync to Microsoft failed:', syncError.message);
        }

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });

    } catch (error) {
        console.error('❌ [Calendar Events] Error deleting event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete event'
        });
    }
});

// Sync events with external calendars (Google, Microsoft)
router.post('/sync/:provider', requireAuth, async (req, res) => {
    try {
        console.log('📅 [Calendar Events] Syncing with provider:', req.params.provider);

        const { provider } = req.params;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user has OAuth tokens for the provider
        let hasToken = false;
        if (provider === 'google') {
            hasToken = user.googleAccessToken && user.googleId;
        } else if (provider === 'microsoft') {
            hasToken = user.microsoftAccessToken && user.microsoftId;
        }

        if (!hasToken) {
            return res.status(400).json({
                success: false,
                error: `No ${provider} integration found. Please connect your ${provider} account first.`
            });
        }

        // Here you would implement actual calendar sync logic
        // For now, we'll just return a success message
        console.log('✅ [Calendar Events] Sync initiated with', provider);

        res.json({
            success: true,
            message: `Sync with ${provider} initiated successfully`,
            provider: provider
        });

    } catch (error) {
        console.error('❌ [Calendar Events] Error syncing with provider:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync with external calendar'
        });
    }
});

module.exports = router;
