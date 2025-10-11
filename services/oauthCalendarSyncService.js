// services/oauthCalendarSyncService.js - Complete OAuth Calendar Sync

const axios = require('axios');
const User = require('../models/User');
const IslamicCalendarService = require('./islamicCalendarService');

class OAuthCalendarSyncService {
    constructor() {
        this.googleCalendarApi = 'https://www.googleapis.com/calendar/v3';
        this.microsoftGraphApi = 'https://graph.microsoft.com/v1.0';
        this.syncLocks = new Map(); // Track active sync operations
        this.islamicCalendarService = new IslamicCalendarService();
    }

    // Sync lock management
    isSyncInProgress(userId, provider) {
        const lockKey = `${userId}_${provider}`;
        return this.syncLocks.has(lockKey);
    }

    setSyncLock(userId, provider) {
        const lockKey = `${userId}_${provider}`;
        this.syncLocks.set(lockKey, Date.now());
    }

    clearSyncLock(userId, provider) {
        const lockKey = `${userId}_${provider}`;
        this.syncLocks.delete(lockKey);
    }

    // Check if Google token has calendar permissions
    async checkGoogleCalendarPermissions(accessToken) {
        try {
            const response = await axios.get(`${this.googleCalendarApi}/users/me/calendarList`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.status === 200;
        } catch (error) {
            console.log('❌ [OAuth Sync] Google calendar permissions check failed:', error.message);
            return false;
        }
    }

    // Check if Microsoft token has calendar permissions
    async checkMicrosoftCalendarPermissions(accessToken) {
        try {
            const response = await axios.get(`${this.microsoftGraphApi}/me/calendars`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.status === 200;
        } catch (error) {
            console.log('❌ [OAuth Sync] Microsoft calendar permissions check failed:', error.message);
            return false;
        }
    }

    // Sync local events to Google Calendar
    async syncLocalEventsToGoogle(user) {
        try {
            // Check if sync is already in progress
            if (this.isSyncInProgress(user._id, 'google')) {
                console.log('⏳ [OAuth Sync] Google sync already in progress for user:', user._id);
                return { eventsCreated: 0, eventsUpdated: 0, eventsSkipped: 0, message: 'Sync already in progress' };
            }

            // Set sync lock
            this.setSyncLock(user._id, 'google');
            console.log('📤 [OAuth Sync] Syncing local events to Google Calendar...');
            
            if (!user.calendarEvents || user.calendarEvents.length === 0) {
                console.log('📤 [OAuth Sync] No local events to sync');
                return { eventsCreated: 0, eventsUpdated: 0, eventsSkipped: 0 };
            }

            let eventsCreated = 0;
            let eventsUpdated = 0;
            let eventsSkipped = 0;

            // Get primary calendar ID
            const primaryCalendar = await this.getGooglePrimaryCalendar(user.googleAccessToken);
            
            // Get existing Google events to check for duplicates
            const existingGoogleEvents = await this.getGoogleCalendarEvents(user.googleAccessToken, primaryCalendar.id);
            
            for (const localEvent of user.calendarEvents) {
                try {
                    // Skip external events (they came from Google)
                    if (localEvent.isExternal && localEvent.externalProvider === 'google') {
                        eventsSkipped++;
                        continue;
                    }

                    // Check if event already exists in Google (by checking if it has googleEventId)
                    if (localEvent.googleEventId) {
                        // Update existing event
                        await this.updateGoogleEvent(user.googleAccessToken, primaryCalendar.id, localEvent);
                        eventsUpdated++;
                        console.log(`📤 [OAuth Sync] Updated Google event: ${localEvent.title}`);
                    } else {
                        // Check for potential duplicates by title and date
                        const potentialDuplicate = this.findPotentialDuplicate(localEvent, existingGoogleEvents);
                        if (potentialDuplicate) {
                            // Link to existing event instead of creating new one
                            localEvent.googleEventId = potentialDuplicate.id;
                            eventsSkipped++;
                            console.log(`📤 [OAuth Sync] Linked to existing Google event: ${localEvent.title}`);
                        } else {
                            // Create new event
                            const googleEvent = await this.createGoogleEvent(user.googleAccessToken, primaryCalendar.id, localEvent);
                            if (googleEvent) {
                                // Update local event with Google event ID
                                localEvent.googleEventId = googleEvent.id;
                                eventsCreated++;
                                console.log(`📤 [OAuth Sync] Created Google event: ${localEvent.title}`);
                            }
                        }
                    }
                } catch (error) {
                    console.log(`❌ [OAuth Sync] Failed to sync local event "${localEvent.title}":`, error.message);
                    eventsSkipped++;
                }
            }

            // Save updated local events with Google event IDs
            await user.save();

            return { eventsCreated, eventsUpdated, eventsSkipped };
        } catch (error) {
            console.error('❌ [OAuth Sync] Error syncing local events to Google:', error);
            throw error;
        } finally {
            // Always clear the sync lock
            this.clearSyncLock(user._id, 'google');
        }
    }

    // Sync Google Calendar events to local
    async syncGoogleEventsToLocal(user) {
        try {
            console.log('📥 [OAuth Sync] Syncing Google Calendar events to local...');
            
            // Get primary calendar
            const primaryCalendar = await this.getGooglePrimaryCalendar(user.googleAccessToken);
            
            // Get events from Google Calendar
            const googleEvents = await this.getGoogleCalendarEvents(user.googleAccessToken, primaryCalendar.id);
            
            let eventsCreated = 0;
            let eventsUpdated = 0;
            let eventsSkipped = 0;

            // Initialize calendarEvents array if it doesn't exist
            if (!user.calendarEvents) {
                user.calendarEvents = [];
            }

            for (const googleEvent of googleEvents) {
                try {
                    // Check if event already exists locally
                    const existingEventIndex = user.calendarEvents.findIndex(
                        localEvent => localEvent.googleEventId === googleEvent.id
                    );

                    if (existingEventIndex !== -1) {
                        // Update existing local event
                        user.calendarEvents[existingEventIndex] = this.convertGoogleEventToLocal(googleEvent);
                        eventsUpdated++;
                        console.log(`📥 [OAuth Sync] Updated local event: ${googleEvent.summary}`);
                    } else {
                        // Create new local event
                        const localEvent = this.convertGoogleEventToLocal(googleEvent);
                        user.calendarEvents.push(localEvent);
                        eventsCreated++;
                        console.log(`📥 [OAuth Sync] Created local event: ${googleEvent.summary}`);
                    }
                } catch (error) {
                    console.log(`❌ [OAuth Sync] Failed to sync Google event "${googleEvent.summary}":`, error.message);
                    eventsSkipped++;
                }
            }

            // Save updated local events
            await user.save();

            return { eventsCreated, eventsUpdated, eventsSkipped };
        } catch (error) {
            console.error('❌ [OAuth Sync] Error syncing Google events to local:', error);
            throw error;
        }
    }

    // Get Google primary calendar
    async getGooglePrimaryCalendar(accessToken) {
        try {
            const response = await axios.get(`${this.googleCalendarApi}/users/me/calendarList`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            // Find primary calendar
            const primaryCalendar = response.data.items.find(cal => cal.primary);
            if (!primaryCalendar) {
                throw new Error('Primary calendar not found');
            }
            
            return primaryCalendar;
        } catch (error) {
            console.error('❌ [OAuth Sync] Error getting primary calendar:', error);
            throw error;
        }
    }

    // Get events from Google Calendar
    async getGoogleCalendarEvents(accessToken, calendarId) {
        try {
            const now = new Date();
            const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

            const response = await axios.get(`${this.googleCalendarApi}/calendars/${calendarId}/events`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                params: {
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                }
            });

            return response.data.items || [];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error getting Google Calendar events:', error);
            throw error;
        }
    }

    // Create event in Google Calendar
    async createGoogleEvent(accessToken, calendarId, localEvent) {
        try {
            // Get user's timezone - try to detect from the date or use a reasonable default
            const userTimezone = localEvent.timezone || 'Asia/Dubai'; // Default to Dubai timezone since you're in UAE
            
            // Format dates properly for Google Calendar - preserve local time
            const formatDateForGoogle = (date) => {
                if (!date) return null;
                
                // Create a date string in the user's timezone without timezone conversion
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                
                // Format as ISO string but without timezone conversion
                const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
                
                return {
                    dateTime: dateTimeString,
                    timeZone: userTimezone
                };
            };

            const googleEvent = {
                summary: localEvent.title,
                description: localEvent.description || '',
                start: formatDateForGoogle(localEvent.startDate),
                end: formatDateForGoogle(localEvent.endDate || localEvent.startDate),
                location: localEvent.location || '',
                extendedProperties: {
                    private: {
                        localEventId: localEvent.id,
                        category: localEvent.category || 'personal',
                        priority: localEvent.priority || 'medium',
                        isIslamicEvent: localEvent.isIslamicEvent || false,
                        prayerTime: localEvent.prayerTime || null
                    }
                }
            };

            // Debug logging for timezone handling
            console.log('🕐 [OAuth Sync] Google event timezone debug:', {
                originalStartDate: localEvent.startDate,
                originalEndDate: localEvent.endDate,
                userTimezone: userTimezone,
                googleStart: googleEvent.start,
                googleEnd: googleEvent.end
            });

            const response = await axios.post(`${this.googleCalendarApi}/calendars/${calendarId}/events`, googleEvent, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ [OAuth Sync] Error creating Google event:', error);
            throw error;
        }
    }

    // Update event in Google Calendar
    async updateGoogleEvent(accessToken, calendarId, localEvent) {
        try {
            // Get user's timezone - same as create method
            const userTimezone = localEvent.timezone || 'Asia/Dubai';
            
            // Format dates properly for Google Calendar - preserve local time
            const formatDateForGoogle = (date) => {
                if (!date) return null;
                
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                
                const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
                
                return {
                    dateTime: dateTimeString,
                    timeZone: userTimezone
                };
            };

            const googleEvent = {
                summary: localEvent.title,
                description: localEvent.description || '',
                start: formatDateForGoogle(localEvent.startDate),
                end: formatDateForGoogle(localEvent.endDate || localEvent.startDate),
                location: localEvent.location || '',
                extendedProperties: {
                    private: {
                        localEventId: localEvent.id,
                        category: localEvent.category || 'personal',
                        priority: localEvent.priority || 'medium',
                        isIslamicEvent: localEvent.isIslamicEvent || false,
                        prayerTime: localEvent.prayerTime || null
                    }
                }
            };

            const response = await axios.put(`${this.googleCalendarApi}/calendars/${calendarId}/events/${localEvent.googleEventId}`, googleEvent, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ [OAuth Sync] Error updating Google event:', error);
            throw error;
        }
    }

    // Convert Google event to local format
    convertGoogleEventToLocal(googleEvent) {
        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            googleEventId: googleEvent.id,
            title: googleEvent.summary || 'Untitled Event',
            description: googleEvent.description || '',
            startDate: new Date(googleEvent.start.dateTime || googleEvent.start.date),
            endDate: googleEvent.end ? new Date(googleEvent.end.dateTime || googleEvent.end.date) : null,
            category: googleEvent.extendedProperties?.private?.category || 'personal',
            priority: googleEvent.extendedProperties?.private?.priority || 'medium',
            location: googleEvent.location || '',
            tags: [],
            isIslamicEvent: googleEvent.extendedProperties?.private?.isIslamicEvent || false,
            prayerTime: googleEvent.extendedProperties?.private?.prayerTime || null,
            isExternal: true, // Mark as external since it came from Google
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    // Refresh Google OAuth token
    async refreshGoogleToken(user) {
        try {
            console.log('🔄 [OAuth Sync] Refreshing Google OAuth token for user:', user.email);
            
            if (!user.googleRefreshToken) {
                throw new Error('Google refresh token not found');
            }

            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: user.googleRefreshToken,
                grant_type: 'refresh_token'
            });

            const { access_token, expires_in } = response.data;
            
            // Update user with new token
            user.googleAccessToken = access_token;
            user.googleTokenExpiry = new Date(Date.now() + (expires_in * 1000));
            await user.save();
            
            console.log('✅ [OAuth Sync] Google token refreshed successfully');
            return access_token;
            
        } catch (error) {
            console.error('❌ [OAuth Sync] Google token refresh failed:', error.message);
            throw new Error('Failed to refresh Google token. Please re-authorize.');
        }
    }

    // Refresh Microsoft OAuth token
    async refreshMicrosoftToken(user) {
        try {
            console.log('🔄 [OAuth Sync] Refreshing Microsoft OAuth token for user:', user.email);
            
            if (!user.microsoftRefreshToken) {
                throw new Error('Microsoft refresh token not found');
            }

            const response = await axios.post(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT || 'common'}/oauth2/v2.0/token`, {
                client_id: process.env.MICROSOFT_CLIENT_ID,
                client_secret: process.env.MICROSOFT_CLIENT_SECRET,
                refresh_token: user.microsoftRefreshToken,
                grant_type: 'refresh_token',
                scope: 'openid email profile User.Read Calendars.Read Calendars.ReadWrite'
            });

            const { access_token, expires_in } = response.data;
            
            // Update user with new token
            user.microsoftAccessToken = access_token;
            user.microsoftTokenExpiry = new Date(Date.now() + (expires_in * 1000));
            await user.save();
            
            console.log('✅ [OAuth Sync] Microsoft token refreshed successfully');
            return access_token;
            
        } catch (error) {
            console.error('❌ [OAuth Sync] Microsoft token refresh failed:', error.message);
            throw new Error('Failed to refresh Microsoft token. Please re-authorize.');
        }
    }

    // Check if token is expired
    isTokenExpired(tokenExpiry) {
        if (!tokenExpiry) return true;
        return new Date() >= new Date(tokenExpiry);
    }

    // Two-way sync with Google Calendar
    async syncWithGoogle(userId) {
        try {
            console.log('🔄 [OAuth Sync] Starting two-way Google Calendar sync for user:', userId);
            
            const user = await User.findById(userId);
            
            console.log('🔍 [OAuth Sync] Google sync - Token check:', {
                userId: userId,
                hasUser: !!user,
                hasGoogleAccessToken: !!user?.googleAccessToken,
                tokenValue: user?.googleAccessToken ? user.googleAccessToken.substring(0, 20) + '...' : 'null/undefined',
                tokenLength: user?.googleAccessToken?.length || 0
            });
            
            if (!user || !user.googleAccessToken || user.googleAccessToken.trim() === '') {
                throw new Error('Google OAuth token not found');
            }

            // Check if token is expired and refresh if needed
            if (this.isTokenExpired(user.googleTokenExpiry)) {
                console.log('🔄 [OAuth Sync] Google token expired, refreshing...');
                await this.refreshGoogleToken(user);
                // Reload user to get updated token
                const updatedUser = await User.findById(userId);
                user.googleAccessToken = updatedUser.googleAccessToken;
            }

            // Check if token has calendar permissions
            const hasCalendarPermissions = await this.checkGoogleCalendarPermissions(user.googleAccessToken);
            if (!hasCalendarPermissions) {
                throw new Error('Google OAuth token does not have calendar permissions. Please re-authorize with calendar access.');
            }

            // Step 1: Sync local events to Google Calendar
            const localToGoogleResult = await this.syncLocalEventsToGoogle(user);
            console.log('📤 [OAuth Sync] Local to Google sync result:', localToGoogleResult);

            // Step 2: Sync Google Calendar events to local
            const googleToLocalResult = await this.syncGoogleEventsToLocal(user);
            console.log('📥 [OAuth Sync] Google to local sync result:', googleToLocalResult);

            // Update last sync time
            user.lastGoogleSync = new Date();
            await user.save();

            return {
                success: true,
                provider: 'google',
                localToGoogle: localToGoogleResult,
                googleToLocal: googleToLocalResult,
                totalSynced: (localToGoogleResult.eventsCreated || 0) + (googleToLocalResult.eventsCreated || 0),
                lastSync: user.lastGoogleSync
            };

        } catch (error) {
            console.error('❌ [OAuth Sync] Google sync error:', error.message);
            throw error;
        }
    }

    // Sync with Microsoft Outlook - Two-way sync
    async syncWithMicrosoft(userId) {
        try {
            console.log('🔄 [OAuth Sync] Starting two-way Microsoft Calendar sync for user:', userId);
            
            const user = await User.findById(userId);
            
            console.log('🔍 [OAuth Sync] Microsoft sync - Token check:', {
                userId: userId,
                hasUser: !!user,
                hasMicrosoftAccessToken: !!user?.microsoftAccessToken,
                tokenValue: user?.microsoftAccessToken ? user.microsoftAccessToken.substring(0, 20) + '...' : 'null/undefined',
                tokenLength: user?.microsoftAccessToken?.length || 0
            });
            
            if (!user || !user.microsoftAccessToken || user.microsoftAccessToken.trim() === '') {
                throw new Error('Microsoft OAuth token not found');
            }

            // Check if token is expired and refresh if needed
            if (this.isTokenExpired(user.microsoftTokenExpiry)) {
                console.log('🔄 [OAuth Sync] Microsoft token expired, refreshing...');
                await this.refreshMicrosoftToken(user);
                // Reload user to get updated token
                const updatedUser = await User.findById(userId);
                user.microsoftAccessToken = updatedUser.microsoftAccessToken;
            }

            // Check if token has calendar permissions
            const hasCalendarPermissions = await this.checkMicrosoftCalendarPermissions(user.microsoftAccessToken);
            if (!hasCalendarPermissions) {
                throw new Error('Microsoft OAuth token does not have calendar permissions. Please re-authorize with calendar access.');
            }

            // Perform two-way sync
            const localToMicrosoftResult = await this.syncLocalEventsToMicrosoft(user);
            console.log('📤 [OAuth Sync] Local to Microsoft sync result:', localToMicrosoftResult);
            
            const microsoftToLocalResult = await this.syncMicrosoftEventsToLocal(user);
            console.log('📥 [OAuth Sync] Microsoft to local sync result:', microsoftToLocalResult);
            
            user.lastMicrosoftSync = new Date();
            await user.save();

            return {
                success: true,
                provider: 'microsoft',
                localToMicrosoft: localToMicrosoftResult,
                microsoftToLocal: microsoftToLocalResult,
                totalSynced: (localToMicrosoftResult.eventsCreated || 0) + (microsoftToLocalResult.eventsCreated || 0),
                lastSync: user.lastMicrosoftSync
            };

        } catch (error) {
            console.error('❌ [OAuth Sync] Microsoft sync error:', error.message);
            throw error;
        }
    }

    // Get Google calendars
    async getGoogleCalendars(accessToken) {
        try {
            const response = await axios.get(`${this.googleCalendarApi}/users/me/calendarList`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.items || [];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error fetching Google calendars:', error.message);
            throw error;
        }
    }

    // Get Google calendar events
    async getGoogleEvents(accessToken, calendarId) {
        try {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

            const response = await axios.get(`${this.googleCalendarApi}/calendars/${calendarId}/events`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    timeMin: now.toISOString(),
                    timeMax: thirtyDaysFromNow.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                }
            });

            return response.data.items || [];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error fetching Google events:', error.message);
            throw error;
        }
    }

    // Get Microsoft calendars
    async getMicrosoftCalendars(accessToken) {
        try {
            const response = await axios.get(`${this.microsoftGraphApi}/me/calendars`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.value || [];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error fetching Microsoft calendars:', error.message);
            throw error;
        }
    }

    // Get Microsoft calendar events
    async getMicrosoftEvents(accessToken, calendarId) {
        try {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

            const response = await axios.get(`${this.microsoftGraphApi}/me/calendars/${calendarId}/events`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    $filter: `start/dateTime ge '${now.toISOString()}' and start/dateTime le '${thirtyDaysFromNow.toISOString()}'`,
                    $orderby: 'start/dateTime'
                }
            });

            return response.data.value || [];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error fetching Microsoft events:', error.message);
            throw error;
        }
    }

    // Convert Google event to our format
    convertGoogleEvent(googleEvent) {
        return {
            id: `google_${googleEvent.id}`,
            title: googleEvent.summary || 'No Title',
            description: googleEvent.description || '',
            startDate: new Date(googleEvent.start.dateTime || googleEvent.start.date),
            endDate: new Date(googleEvent.end.dateTime || googleEvent.end.date),
            location: googleEvent.location || '',
            category: 'external',
            priority: 'medium',
            tags: ['google', 'synced'],
            isExternal: true,
            externalId: googleEvent.id,
            externalProvider: 'google',
            externalUrl: googleEvent.htmlLink,
            attendees: googleEvent.attendees ? googleEvent.attendees.map(a => ({
                email: a.email,
                name: a.displayName,
                status: a.responseStatus
            })) : [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    // Convert Microsoft event to our format
    convertMicrosoftEvent(microsoftEvent) {
        return {
            id: `microsoft_${microsoftEvent.id}`,
            microsoftEventId: microsoftEvent.id, // Store Microsoft event ID for sync
            title: microsoftEvent.subject || 'No Title',
            description: microsoftEvent.body?.content || '',
            startDate: new Date(microsoftEvent.start.dateTime),
            endDate: new Date(microsoftEvent.end.dateTime),
            location: microsoftEvent.location?.displayName || '',
            category: 'external',
            priority: 'medium',
            tags: ['microsoft', 'synced'],
            isExternal: true,
            externalId: microsoftEvent.id,
            externalProvider: 'microsoft',
            externalUrl: microsoftEvent.webLink,
            attendees: microsoftEvent.attendees ? microsoftEvent.attendees.map(a => ({
                email: a.emailAddress.address,
                name: a.emailAddress.name,
                status: a.status.response
            })) : [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    // Sync local events to Microsoft Calendar
    async syncLocalEventsToMicrosoft(user) {
        try {
            // Check if sync is already in progress
            if (this.isSyncInProgress(user._id, 'microsoft')) {
                console.log('⏳ [OAuth Sync] Microsoft sync already in progress for user:', user._id);
                return { eventsCreated: 0, eventsUpdated: 0, eventsSkipped: 0, message: 'Sync already in progress' };
            }

            // Set sync lock
            this.setSyncLock(user._id, 'microsoft');
            console.log('📤 [OAuth Sync] Syncing local events to Microsoft Calendar for user:', user._id);
            
            const primaryCalendar = await this.getMicrosoftPrimaryCalendar(user.microsoftAccessToken);
            if (!primaryCalendar) {
                throw new Error('No Microsoft primary calendar found');
            }

            const localEvents = user.calendarEvents.filter(event => !event.isExternal);
            let eventsCreated = 0;
            let eventsUpdated = 0;
            let eventsSkipped = 0;

            // Get existing Microsoft events to check for duplicates
            const existingMicrosoftEvents = await this.getMicrosoftCalendarEvents(user.microsoftAccessToken, primaryCalendar.id);

            for (const event of localEvents) {
                try {
                    // Skip external events (they came from Microsoft)
                    if (event.isExternal && event.externalProvider === 'microsoft') {
                        eventsSkipped++;
                        continue;
                    }

                    if (event.microsoftEventId) {
                        // Update existing event
                        await this.updateMicrosoftEvent(user.microsoftAccessToken, primaryCalendar.id, event);
                        eventsUpdated++;
                        console.log('📝 [OAuth Sync] Updated Microsoft event:', event.title);
                    } else {
                        // Check for potential duplicates by title and date
                        const potentialDuplicate = this.findPotentialDuplicate(event, existingMicrosoftEvents, 'microsoft');
                        if (potentialDuplicate) {
                            // Link to existing event instead of creating new one
                            event.microsoftEventId = potentialDuplicate.id;
                            eventsSkipped++;
                            console.log('📝 [OAuth Sync] Linked to existing Microsoft event:', event.title);
                        } else {
                            // Create new event
                            const microsoftEvent = await this.createMicrosoftEvent(user.microsoftAccessToken, primaryCalendar.id, event);
                            if (microsoftEvent) {
                                // Update local event with Microsoft event ID
                                event.microsoftEventId = microsoftEvent.id;
                                eventsCreated++;
                                console.log('➕ [OAuth Sync] Created Microsoft event:', event.title);
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ [OAuth Sync] Error syncing event to Microsoft:', event.title, error.message);
                    eventsSkipped++;
                }
            }

            // Save updated events with Microsoft IDs
            await user.save();

            console.log('✅ [OAuth Sync] Local to Microsoft sync completed:', { eventsCreated, eventsUpdated, eventsSkipped });
            return { eventsCreated, eventsUpdated, eventsSkipped };

        } catch (error) {
            console.error('❌ [OAuth Sync] Error syncing local events to Microsoft:', error.message);
            throw error;
        } finally {
            // Always clear the sync lock
            this.clearSyncLock(user._id, 'microsoft');
        }
    }

    // Sync Microsoft events to local calendar
    async syncMicrosoftEventsToLocal(user) {
        try {
            console.log('📥 [OAuth Sync] Syncing Microsoft events to local calendar for user:', user._id);
            
            const primaryCalendar = await this.getMicrosoftPrimaryCalendar(user.microsoftAccessToken);
            if (!primaryCalendar) {
                throw new Error('No Microsoft primary calendar found');
            }

            const microsoftEvents = await this.getMicrosoftCalendarEvents(user.microsoftAccessToken, primaryCalendar.id);
            let eventsCreated = 0;
            let eventsUpdated = 0;

            for (const microsoftEvent of microsoftEvents) {
                try {
                    const existingEvent = user.calendarEvents.find(event => 
                        event.microsoftEventId === microsoftEvent.id
                    );

                    if (existingEvent) {
                        // Update existing local event
                        const updatedEvent = this.convertMicrosoftEventToLocal(microsoftEvent);
                        Object.assign(existingEvent, updatedEvent);
                        eventsUpdated++;
                        console.log('📝 [OAuth Sync] Updated local event from Microsoft:', microsoftEvent.subject);
                    } else {
                        // Create new local event
                        const newEvent = this.convertMicrosoftEventToLocal(microsoftEvent);
                        user.calendarEvents.push(newEvent);
                        eventsCreated++;
                        console.log('➕ [OAuth Sync] Created local event from Microsoft:', microsoftEvent.subject);
                    }
                } catch (error) {
                    console.error('❌ [OAuth Sync] Error syncing Microsoft event to local:', microsoftEvent.subject, error.message);
                }
            }

            await user.save();

            console.log('✅ [OAuth Sync] Microsoft to local sync completed:', { eventsCreated, eventsUpdated });
            return { eventsCreated, eventsUpdated };

        } catch (error) {
            console.error('❌ [OAuth Sync] Error syncing Microsoft events to local:', error.message);
            throw error;
        }
    }

    // Get Microsoft primary calendar
    async getMicrosoftPrimaryCalendar(accessToken) {
        try {
            const calendars = await this.getMicrosoftCalendars(accessToken);
            return calendars.find(cal => cal.isDefaultCalendar) || calendars[0];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error getting Microsoft primary calendar:', error.message);
            throw error;
        }
    }

    // Get Microsoft calendar events
    async getMicrosoftCalendarEvents(accessToken, calendarId) {
        try {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

            const response = await axios.get(`${this.microsoftGraphApi}/me/calendars/${calendarId}/events`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    $filter: `start/dateTime ge '${now.toISOString()}' and start/dateTime le '${thirtyDaysFromNow.toISOString()}'`,
                    $orderby: 'start/dateTime'
                }
            });

            return response.data.value || [];
        } catch (error) {
            console.error('❌ [OAuth Sync] Error fetching Microsoft events:', error.message);
            throw error;
        }
    }

    // Update Microsoft event
    async updateMicrosoftEvent(accessToken, calendarId, event) {
        try {
            const microsoftEvent = {
                subject: event.title,
                body: {
                    contentType: 'text',
                    content: event.description
                },
                start: {
                    dateTime: event.startDate.toISOString(),
                    timeZone: 'UTC'
                },
                end: {
                    dateTime: event.endDate.toISOString(),
                    timeZone: 'UTC'
                },
                location: {
                    displayName: event.location
                }
            };

            const response = await axios.patch(`${this.microsoftGraphApi}/me/calendars/${calendarId}/events/${event.microsoftEventId}`, microsoftEvent, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ [OAuth Sync] Error updating Microsoft event:', error.message);
            return null;
        }
    }

    // Convert Microsoft event to local format
    convertMicrosoftEventToLocal(microsoftEvent) {
        return {
            id: `microsoft_${microsoftEvent.id}`,
            microsoftEventId: microsoftEvent.id,
            title: microsoftEvent.subject || 'No Title',
            description: microsoftEvent.body?.content || '',
            startDate: new Date(microsoftEvent.start.dateTime),
            endDate: new Date(microsoftEvent.end.dateTime),
            location: microsoftEvent.location?.displayName || '',
            category: 'external',
            priority: 'medium',
            tags: ['microsoft', 'synced'],
            isExternal: true,
            externalId: microsoftEvent.id,
            externalProvider: 'microsoft',
            externalUrl: microsoftEvent.webLink,
            attendees: microsoftEvent.attendees ? microsoftEvent.attendees.map(a => ({
                email: a.emailAddress.address,
                name: a.emailAddress.name,
                status: a.status.response
            })) : [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    // Find potential duplicate events by title and date
    findPotentialDuplicate(localEvent, existingEvents, provider = 'google') {
        if (!existingEvents || existingEvents.length === 0) {
            return null;
        }

        const localStartDate = new Date(localEvent.startDate);
        const localEndDate = new Date(localEvent.endDate);
        
        // Allow 5 minutes tolerance for time differences
        const timeTolerance = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        // Check if event was created recently (within last 10 minutes) to avoid linking to old events
        const recentThreshold = 10 * 60 * 1000; // 10 minutes
        const now = Date.now();

        for (const existingEvent of existingEvents) {
            // Check if existing event was created recently
            const existingCreatedTime = provider === 'google' 
                ? new Date(existingEvent.created || existingEvent.start.dateTime).getTime()
                : new Date(existingEvent.createdDateTime || existingEvent.start.dateTime).getTime();
            
            if (now - existingCreatedTime > recentThreshold) {
                continue; // Skip events older than 10 minutes
            }
            // Compare titles (case insensitive, trimmed)
            const localTitle = localEvent.title?.trim().toLowerCase() || '';
            const existingTitle = provider === 'google' 
                ? (existingEvent.summary?.trim().toLowerCase() || '')
                : (existingEvent.subject?.trim().toLowerCase() || '');
            
            if (localTitle !== existingTitle) {
                continue;
            }

            // Compare start dates
            const existingStartDate = provider === 'google'
                ? new Date(existingEvent.start.dateTime || existingEvent.start.date)
                : new Date(existingEvent.start.dateTime);
            
            const startTimeDiff = Math.abs(localStartDate.getTime() - existingStartDate.getTime());
            if (startTimeDiff > timeTolerance) {
                continue;
            }

            // Compare end dates (if both have end dates)
            if (localEvent.endDate && existingEvent.end) {
                const existingEndDate = provider === 'google'
                    ? new Date(existingEvent.end.dateTime || existingEvent.end.date)
                    : new Date(existingEvent.end.dateTime);
                
                const endTimeDiff = Math.abs(localEndDate.getTime() - existingEndDate.getTime());
                if (endTimeDiff > timeTolerance) {
                    continue;
                }
            }

            // Found a potential duplicate
            console.log(`🔍 [OAuth Sync] Found potential duplicate: "${localEvent.title}" at ${localStartDate.toISOString()}`);
            return existingEvent;
        }

        return null;
    }

    // Push events to Google Calendar
    async pushToGoogle(userId, events) {
        try {
            console.log('📤 [OAuth Sync] Pushing events to Google Calendar for user:', userId);
            
            const user = await User.findById(userId);
            if (!user || !user.googleAccessToken) {
                throw new Error('Google OAuth token not found');
            }

            // Get primary calendar
            const calendars = await this.getGoogleCalendars(user.googleAccessToken);
            const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];
            
            if (!primaryCalendar) {
                throw new Error('No Google calendar found');
            }

            // Create events in Google Calendar
            const createdEvents = [];
            for (const event of events) {
                if (!event.isExternal) { // Only push non-external events
                    const googleEvent = await this.createGoogleEvent(user.googleAccessToken, primaryCalendar.id, event);
                    if (googleEvent) {
                        createdEvents.push(googleEvent);
                    }
                }
            }

            console.log('✅ [OAuth Sync] Pushed to Google Calendar:', createdEvents.length, 'events');
            return { success: true, eventsCount: createdEvents.length };

        } catch (error) {
            console.error('❌ [OAuth Sync] Error pushing to Google:', error.message);
            throw error;
        }
    }

    // Push events to Microsoft Calendar
    async pushToMicrosoft(userId, events) {
        try {
            console.log('📤 [OAuth Sync] Pushing events to Microsoft Calendar for user:', userId);
            
            const user = await User.findById(userId);
            if (!user || !user.microsoftAccessToken) {
                throw new Error('Microsoft OAuth token not found');
            }

            // Get primary calendar
            const calendars = await this.getMicrosoftCalendars(user.microsoftAccessToken);
            const primaryCalendar = calendars.find(cal => cal.isDefaultCalendar) || calendars[0];
            
            if (!primaryCalendar) {
                throw new Error('No Microsoft calendar found');
            }

            // Create events in Microsoft Calendar
            const createdEvents = [];
            for (const event of events) {
                if (!event.isExternal) { // Only push non-external events
                    const microsoftEvent = await this.createMicrosoftEvent(user.microsoftAccessToken, primaryCalendar.id, event);
                    if (microsoftEvent) {
                        createdEvents.push(microsoftEvent);
                    }
                }
            }

            console.log('✅ [OAuth Sync] Pushed to Microsoft Calendar:', createdEvents.length, 'events');
            return { success: true, eventsCount: createdEvents.length };

        } catch (error) {
            console.error('❌ [OAuth Sync] Error pushing to Microsoft:', error.message);
            throw error;
        }
    }

    // Create Google event
    async createGoogleEvent(accessToken, calendarId, event) {
        try {
            const googleEvent = {
                summary: event.title,
                description: event.description,
                start: {
                    dateTime: event.startDate.toISOString(),
                    timeZone: 'UTC'
                },
                end: {
                    dateTime: event.endDate.toISOString(),
                    timeZone: 'UTC'
                },
                location: event.location
            };

            const response = await axios.post(`${this.googleCalendarApi}/calendars/${calendarId}/events`, googleEvent, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ [OAuth Sync] Error creating Google event:', error.message);
            return null;
        }
    }

    // Create Microsoft event
    async createMicrosoftEvent(accessToken, calendarId, event) {
        try {
            const microsoftEvent = {
                subject: event.title,
                body: {
                    contentType: 'text',
                    content: event.description
                },
                start: {
                    dateTime: event.startDate.toISOString(),
                    timeZone: 'UTC'
                },
                end: {
                    dateTime: event.endDate.toISOString(),
                    timeZone: 'UTC'
                },
                location: {
                    displayName: event.location
                }
            };

            const response = await axios.post(`${this.microsoftGraphApi}/me/calendars/${calendarId}/events`, microsoftEvent, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ [OAuth Sync] Error creating Microsoft event:', error.message);
            return null;
        }
    }

    // Two-way sync (pull and push)
    async twoWaySync(userId, provider) {
        try {
            console.log('🔄 [OAuth Sync] Starting two-way sync for provider:', provider);
            
            if (provider === 'google') {
                // Pull from Google
                await this.syncWithGoogle(userId);
                
                // Get user's local events
                const user = await User.findById(userId);
                const localEvents = user.calendarEvents.filter(event => !event.isExternal);
                
                // Push local events to Google
                if (localEvents.length > 0) {
                    await this.pushToGoogle(userId, localEvents);
                }
            } else if (provider === 'microsoft') {
                // Pull from Microsoft
                await this.syncWithMicrosoft(userId);
                
                // Get user's local events
                const user = await User.findById(userId);
                const localEvents = user.calendarEvents.filter(event => !event.isExternal);
                
                // Push local events to Microsoft
                if (localEvents.length > 0) {
                    await this.pushToMicrosoft(userId, localEvents);
                }
            }

            console.log('✅ [OAuth Sync] Two-way sync completed for provider:', provider);
            return { success: true, provider };

        } catch (error) {
            console.error('❌ [OAuth Sync] Two-way sync error:', error.message);
            throw error;
        }
    }

    // Sync Islamic events to external calendars
    async syncIslamicEvents(userId, provider, latitude, longitude, country = 'AE') {
        try {
            console.log('🕌 [OAuth Sync] Starting Islamic events sync for provider:', provider);
            
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Get Islamic events for current month
            const currentDate = new Date();
            const islamicEvents = await this.islamicCalendarService.getMonthlyIslamicEvents(
                currentDate.getFullYear(),
                currentDate.getMonth() + 1,
                latitude,
                longitude,
                country
            );

            let syncResult = { eventsCreated: 0, eventsUpdated: 0, eventsSkipped: 0 };

            if (provider === 'google') {
                syncResult = await this.syncIslamicEventsToGoogle(user, islamicEvents);
            } else if (provider === 'microsoft') {
                syncResult = await this.syncIslamicEventsToMicrosoft(user, islamicEvents);
            }

            console.log('✅ [OAuth Sync] Islamic events sync completed:', syncResult);
            return { success: true, provider, ...syncResult };

        } catch (error) {
            console.error('❌ [OAuth Sync] Islamic events sync error:', error.message);
            throw error;
        }
    }

    // Sync Islamic events to Google Calendar
    async syncIslamicEventsToGoogle(user, islamicEvents) {
        try {
            const accessToken = user.googleAccessToken;
            if (!accessToken) {
                throw new Error('Google access token not found');
            }

            let eventsCreated = 0;
            let eventsUpdated = 0;
            let eventsSkipped = 0;

            // Sync holidays
            for (const holiday of islamicEvents.holidays) {
                try {
                    const event = {
                        summary: holiday.name,
                        description: `${holiday.nameAr}\nType: ${holiday.type}\nCountry: ${holiday.country}`,
                        start: {
                            date: holiday.date.split('T')[0],
                            timeZone: 'Asia/Dubai'
                        },
                        end: {
                            date: holiday.date.split('T')[0],
                            timeZone: 'Asia/Dubai'
                        },
                        colorId: holiday.type === 'public' ? '2' : '11', // Green for public, Red for religious
                        extendedProperties: {
                            private: {
                                isIslamicEvent: true,
                                eventType: 'holiday',
                                country: holiday.country
                            }
                        }
                    };

                    await axios.post(`${this.googleCalendarApi}/calendars/primary/events`, event, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    eventsCreated++;
                } catch (error) {
                    if (error.response?.status === 409) {
                        eventsSkipped++;
                    } else {
                        console.error('Error creating Google holiday event:', error.message);
                    }
                }
            }

            // Sync prayer events
            for (const prayer of islamicEvents.prayerEvents) {
                try {
                    const event = {
                        summary: prayer.title,
                        description: prayer.description,
                        start: {
                            dateTime: prayer.start.toISOString(),
                            timeZone: 'Asia/Dubai'
                        },
                        end: {
                            dateTime: prayer.end.toISOString(),
                            timeZone: 'Asia/Dubai'
                        },
                        colorId: '10', // Blue for prayer times
                        extendedProperties: {
                            private: {
                                isIslamicEvent: true,
                                eventType: 'prayer',
                                category: prayer.category
                            }
                        }
                    };

                    await axios.post(`${this.googleCalendarApi}/calendars/primary/events`, event, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    eventsCreated++;
                } catch (error) {
                    if (error.response?.status === 409) {
                        eventsSkipped++;
                    } else {
                        console.error('Error creating Google prayer event:', error.message);
                    }
                }
            }

            return { eventsCreated, eventsUpdated, eventsSkipped };

        } catch (error) {
            console.error('Error syncing Islamic events to Google:', error);
            throw error;
        }
    }

    // Sync Islamic events to Microsoft Calendar
    async syncIslamicEventsToMicrosoft(user, islamicEvents) {
        try {
            const accessToken = user.microsoftAccessToken;
            if (!accessToken) {
                throw new Error('Microsoft access token not found');
            }

            let eventsCreated = 0;
            let eventsUpdated = 0;
            let eventsSkipped = 0;

            // Sync holidays
            for (const holiday of islamicEvents.holidays) {
                try {
                    const event = {
                        subject: holiday.name,
                        body: {
                            contentType: 'HTML',
                            content: `<p>${holiday.nameAr}</p><p>Type: ${holiday.type}</p><p>Country: ${holiday.country}</p>`
                        },
                        start: {
                            dateTime: holiday.date + 'T00:00:00',
                            timeZone: 'Asia/Dubai'
                        },
                        end: {
                            dateTime: holiday.date + 'T23:59:59',
                            timeZone: 'Asia/Dubai'
                        },
                        categories: [holiday.type === 'public' ? 'Green Category' : 'Red Category'],
                        singleValueExtendedProperties: [
                            {
                                id: 'String {66f5a359-4659-4830-9070-00047ec6ac6f} Name isIslamicEvent',
                                value: 'true'
                            }
                        ]
                    };

                    await axios.post(`${this.microsoftGraphApi}/me/events`, event, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    eventsCreated++;
                } catch (error) {
                    if (error.response?.status === 409) {
                        eventsSkipped++;
                    } else {
                        console.error('Error creating Microsoft holiday event:', error.message);
                    }
                }
            }

            // Sync prayer events
            for (const prayer of islamicEvents.prayerEvents) {
                try {
                    const event = {
                        subject: prayer.title,
                        body: {
                            contentType: 'HTML',
                            content: `<p>${prayer.description}</p>`
                        },
                        start: {
                            dateTime: prayer.start.toISOString(),
                            timeZone: 'Asia/Dubai'
                        },
                        end: {
                            dateTime: prayer.end.toISOString(),
                            timeZone: 'Asia/Dubai'
                        },
                        categories: ['Blue Category'],
                        singleValueExtendedProperties: [
                            {
                                id: 'String {66f5a359-4659-4830-9070-00047ec6ac6f} Name isIslamicEvent',
                                value: 'true'
                            }
                        ]
                    };

                    await axios.post(`${this.microsoftGraphApi}/me/events`, event, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    eventsCreated++;
                } catch (error) {
                    if (error.response?.status === 409) {
                        eventsSkipped++;
                    } else {
                        console.error('Error creating Microsoft prayer event:', error.message);
                    }
                }
            }

            return { eventsCreated, eventsUpdated, eventsSkipped };

        } catch (error) {
            console.error('Error syncing Islamic events to Microsoft:', error);
            throw error;
        }
    }
}

module.exports = new OAuthCalendarSyncService();
