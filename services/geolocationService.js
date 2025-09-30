// Geolocation Service
const axios = require('axios');
const { get, set } = require('./diskPersistence');
const { safeLogAuthEvent } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');

class GeolocationService {
    constructor() {
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.apiServices = [
            {
                name: 'ipapi',
                url: 'http://ip-api.com/json/{ip}',
                parser: this.parseIpApiResponse
            },
            {
                name: 'ipinfo',
                url: 'https://ipinfo.io/{ip}/json',
                parser: this.parseIpInfoResponse
            }
        ];
    }

    /**
     * Get geolocation data for IP
     */
    async getLocation(ip) {
        try {
            // Check cache first
            const cached = await this.getCachedLocation(ip);
            if (cached) {
                return cached;
            }

            // Get location from API
            const location = await this.fetchLocationFromAPI(ip);
            
            // Cache the result
            await this.cacheLocation(ip, location);
            
            return location;
        } catch (error) {
            console.error('❌ Geolocation: Error getting location:', error);
            return this.getDefaultLocation(ip);
        }
    }

    /**
     * Get cached location
     */
    async getCachedLocation(ip) {
        try {
            const key = `geolocation:${ip}`;
            const cached = await get(key);

            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        } catch (error) {
            console.error('❌ Geolocation: Error getting cached location:', error);
            return null;
        }
    }

    /**
     * Cache location data
     */
    async cacheLocation(ip, location) {
        try {
            const key = `geolocation:${ip}`;
            await set(key, JSON.stringify(location), this.cacheExpiry);
        } catch (error) {
            console.error('❌ Geolocation: Error caching location:', error);
        }
    }

    /**
     * Fetch location from API services
     */
    async fetchLocationFromAPI(ip) {
        for (const service of this.apiServices) {
            try {
                const url = service.url.replace('{ip}', ip);
                const response = await axios.get(url, { timeout: 5000 });
                
                if (response.status === 200) {
                    const location = service.parser(response.data);
                    if (location) {
                        return location;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Geolocation: Service ${service.name} failed:`, error.message);
                continue;
            }
        }

        throw new Error('All geolocation services failed');
    }

    /**
     * Parse ip-api.com response
     */
    parseIpApiResponse(data) {
        if (data.status === 'fail') {
            return null;
        }

        return {
            ip: data.query,
            country: data.country,
            countryCode: data.countryCode,
            region: data.region,
            regionName: data.regionName,
            city: data.city,
            zip: data.zip,
            lat: data.lat,
            lon: data.lon,
            timezone: data.timezone,
            isp: data.isp,
            org: data.org,
            as: data.as,
            mobile: data.mobile,
            proxy: data.proxy,
            hosting: data.hosting,
            source: 'ip-api'
        };
    }

    /**
     * Parse ipinfo.io response
     */
    parseIpInfoResponse(data) {
        if (data.error) {
            return null;
        }

        const [lat, lon] = data.loc ? data.loc.split(',').map(Number) : [null, null];

        return {
            ip: data.ip,
            country: data.country,
            countryCode: data.country,
            region: data.region,
            regionName: data.region,
            city: data.city,
            zip: data.postal,
            lat: lat,
            lon: lon,
            timezone: data.timezone,
            isp: data.org,
            org: data.org,
            as: null,
            mobile: null,
            proxy: null,
            hosting: null,
            source: 'ipinfo'
        };
    }

    /**
     * Get default location for unknown IPs
     */
    getDefaultLocation(ip) {
        return {
            ip: ip,
            country: 'Unknown',
            countryCode: 'XX',
            region: 'Unknown',
            regionName: 'Unknown',
            city: 'Unknown',
            zip: null,
            lat: null,
            lon: null,
            timezone: null,
            isp: 'Unknown',
            org: 'Unknown',
            as: null,
            mobile: false,
            proxy: false,
            hosting: false,
            source: 'default'
        };
    }

    /**
     * Track user location for security
     */
    async trackUserLocation(userId, ip, userAgent) {
        try {
            const location = await this.getLocation(ip);
            
            // Store user location history
            await this.storeUserLocation(userId, location, userAgent);
            
            // Check for suspicious location
            await this.checkSuspiciousLocation(userId, location);
            
            return location;
        } catch (error) {
            console.error('❌ Geolocation: Error tracking user location:', error);
            return this.getDefaultLocation(ip);
        }
    }

    /**
     * Store user location history
     */
    async storeUserLocation(userId, location, userAgent) {
        try {
            const key = `user_locations:${userId}`;
            const locationData = {
                ...location,
                userAgent: userAgent,
                timestamp: Date.now()
            };

            const existingLocations = await get(key);
            const locations = existingLocations ? JSON.parse(existingLocations) : [];
            locations.unshift(locationData);
            locations.splice(50); // Keep only last 50 locations
            await set(key, JSON.stringify(locations), 30 * 24 * 60 * 60 * 1000); // 30 days
        } catch (error) {
            console.error('❌ Geolocation: Error storing user location:', error);
        }
    }

    /**
     * Check for suspicious location patterns
     */
    async checkSuspiciousLocation(userId, currentLocation) {
        try {
            const locations = await this.getUserLocationHistory(userId);
            
            if (locations.length < 2) {
                return; // Not enough data
            }

            const now = Date.now();
            const recentLocations = locations.filter(loc => 
                now - loc.timestamp <= 24 * 60 * 60 * 1000 // Last 24 hours
            );

            // Check for impossible travel
            const suspicious = this.detectImpossibleTravel(recentLocations, currentLocation);
            if (suspicious) {
                await safeLogAuthEvent('SUSPICIOUS_LOCATION', {
                    userId: userId,
                    ip: currentLocation.ip,
                    userAgent: 'unknown',
                    location: currentLocation,
                    reason: suspicious.reason,
                    riskScore: suspicious.riskScore
                });
            }

            // Check for new country
            const countries = new Set(recentLocations.map(loc => loc.country));
            if (!countries.has(currentLocation.country) && countries.size > 0) {
                await safeLogAuthEvent('NEW_COUNTRY_LOGIN', {
                    userId: userId,
                    ip: currentLocation.ip,
                    userAgent: 'unknown',
                    location: currentLocation,
                    previousCountries: Array.from(countries)
                });
            }
        } catch (error) {
            console.error('❌ Geolocation: Error checking suspicious location:', error);
        }
    }

    /**
     * Detect impossible travel
     */
    detectImpossibleTravel(locations, currentLocation) {
        if (!currentLocation.lat || !currentLocation.lon) {
            return null;
        }

        const now = Date.now();
        const maxSpeed = 1000; // km/h (commercial aircraft speed)

        for (const location of locations) {
            if (!location.lat || !location.lon) continue;

            const distance = this.calculateDistance(
                { lat: location.lat, lon: location.lon },
                { lat: currentLocation.lat, lon: currentLocation.lon }
            );

            const timeDiff = (now - location.timestamp) / 3600000; // hours
            const speed = distance / timeDiff;

            if (speed > maxSpeed) {
                return {
                    reason: 'Impossible travel detected',
                    riskScore: 80,
                    distance: distance,
                    timeDiff: timeDiff,
                    speed: speed
                };
            }
        }

        return null;
    }

    /**
     * Calculate distance between two points
     */
    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(point2.lat - point1.lat);
        const dLon = this.toRadians(point2.lon - point1.lon);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get user location history
     */
    async getUserLocationHistory(userId) {
        try {
            const key = `user_locations:${userId}`;
            const data = await get(key);
            const locations = data ? JSON.parse(data) : [];

            return locations;
        } catch (error) {
            console.error('❌ Geolocation: Error getting user location history:', error);
            return [];
        }
    }

    /**
     * Get location statistics
     */
    async getLocationStats(userId) {
        try {
            const locations = await this.getUserLocationHistory(userId);
            
            if (locations.length === 0) {
                return {
                    totalLocations: 0,
                    countries: [],
                    cities: [],
                    isps: [],
                    lastLocation: null
                };
            }

            const countries = [...new Set(locations.map(loc => loc.country))];
            const cities = [...new Set(locations.map(loc => loc.city))];
            const isps = [...new Set(locations.map(loc => loc.isp))];

            return {
                totalLocations: locations.length,
                countries: countries,
                cities: cities,
                isps: isps,
                lastLocation: locations[0]
            };
        } catch (error) {
            console.error('❌ Geolocation: Error getting location stats:', error);
            return {
                totalLocations: 0,
                countries: [],
                cities: [],
                isps: [],
                lastLocation: null
            };
        }
    }
}

module.exports = new GeolocationService();
