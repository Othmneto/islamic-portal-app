const axios = require('axios');
const { logger } = require('../config/logger');
const moment = require('moment-hijri');

class IslamicCalendarService {
    constructor() {
        this.hijriApiUrl = 'https://api.aladhan.com/v1/gToH';
        this.prayerTimesApiUrl = 'https://api.aladhan.com/v1/timings';
        this.islamicHolidays = this.initializeIslamicHolidays();
        this.countryHolidays = this.initializeCountryHolidays();
        this.prayerCalculationMethods = {
            'UAE': 4, 'SA': 4, 'KW': 4, 'QA': 4, 'BH': 4, 'OM': 4,
            'EG': 5, 'MA': 4, 'DZ': 4, 'TN': 4, 'LY': 4,
            'TR': 2, 'PK': 1, 'BD': 1, 'IN': 1, 'ID': 1, 'MY': 1,
            'US': 2, 'CA': 2, 'GB': 1, 'FR': 12, 'DE': 4
        };
        this.hijriMonthNames = [
            'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
            'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
            'Ramadan', 'Shawwal', "Dhu al-Qi'dah", "Dhu al-Hijjah"
        ];
        this.hijriMonthNamesAr = [
            'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
            'جمادى الأولى', 'جمادى الثانية', 'رجب', 'شعبان',
            'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
        ];
    }

    initializeIslamicHolidays() {
        return {
            // Fixed Islamic holidays (same date every year in Hijri calendar)
            '1-1': { name: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', type: 'religious' },
            '1-10': { name: 'Day of Ashura', nameAr: 'يوم عاشوراء', type: 'religious' },
            '3-12': { name: 'Mawlid al-Nabi', nameAr: 'المولد النبوي', type: 'religious' },
            '7-27': { name: 'Laylat al-Qadr', nameAr: 'ليلة القدر', type: 'religious' },
            '9-1': { name: 'First Day of Ramadan', nameAr: 'أول أيام رمضان', type: 'religious' },
            '9-27': { name: 'Laylat al-Qadr', nameAr: 'ليلة القدر', type: 'religious' },
            '10-1': { name: 'Eid al-Fitr', nameAr: 'عيد الفطر', type: 'religious' },
            '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'عيد الفطر (اليوم الثاني)', type: 'religious' },
            '10-3': { name: 'Eid al-Fitr (3rd Day)', nameAr: 'عيد الفطر (اليوم الثالث)', type: 'religious' },
            '12-8': { name: 'Day of Arafah', nameAr: 'يوم عرفة', type: 'religious' },
            '12-9': { name: 'Eid al-Adha', nameAr: 'عيد الأضحى', type: 'religious' },
            '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'عيد الأضحى (اليوم الثاني)', type: 'religious' },
            '12-11': { name: 'Eid al-Adha (3rd Day)', nameAr: 'عيد الأضحى (اليوم الثالث)', type: 'religious' }
        };
    }

    initializeCountryHolidays() {
        return {
            // UAE
            'AE': {
                '1-1': { name: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', type: 'public' },
                '3-12': { name: 'Mawlid al-Nabi', nameAr: 'المولد النبوي', type: 'public' },
                '7-27': { name: 'Laylat al-Qadr', nameAr: 'ليلة القدر', type: 'public' },
                '9-1': { name: 'First Day of Ramadan', nameAr: 'أول أيام رمضان', type: 'public' },
                '10-1': { name: 'Eid al-Fitr', nameAr: 'عيد الفطر', type: 'public' },
                '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'عيد الفطر (اليوم الثاني)', type: 'public' },
                '10-3': { name: 'Eid al-Fitr (3rd Day)', nameAr: 'عيد الفطر (اليوم الثالث)', type: 'public' },
                '12-9': { name: 'Eid al-Adha', nameAr: 'عيد الأضحى', type: 'public' },
                '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'عيد الأضحى (اليوم الثاني)', type: 'public' },
                '12-11': { name: 'Eid al-Adha (3rd Day)', nameAr: 'عيد الأضحى (اليوم الثالث)', type: 'public' },
                '12-1': { name: 'UAE National Day', nameAr: 'اليوم الوطني', type: 'national' },
                '12-2': { name: 'UAE National Day (2nd Day)', nameAr: 'اليوم الوطني (اليوم الثاني)', type: 'national' }
            },
            // Saudi Arabia
            'SA': {
                '1-1': { name: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', type: 'public' },
                '3-12': { name: 'Mawlid al-Nabi', nameAr: 'المولد النبوي', type: 'public' },
                '7-27': { name: 'Laylat al-Qadr', nameAr: 'ليلة القدر', type: 'public' },
                '9-1': { name: 'First Day of Ramadan', nameAr: 'أول أيام رمضان', type: 'public' },
                '10-1': { name: 'Eid al-Fitr', nameAr: 'عيد الفطر', type: 'public' },
                '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'عيد الفطر (اليوم الثاني)', type: 'public' },
                '10-3': { name: 'Eid al-Fitr (3rd Day)', nameAr: 'عيد الفطر (اليوم الثالث)', type: 'public' },
                '12-9': { name: 'Eid al-Adha', nameAr: 'عيد الأضحى', type: 'public' },
                '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'عيد الأضحى (اليوم الثاني)', type: 'public' },
                '12-11': { name: 'Eid al-Adha (3rd Day)', nameAr: 'عيد الأضحى (اليوم الثالث)', type: 'public' },
                '2-22': { name: 'Saudi National Day', nameAr: 'اليوم الوطني السعودي', type: 'national' }
            },
            // Turkey
            'TR': {
                '1-1': { name: 'Islamic New Year', nameAr: 'Hicri Yılbaşı', type: 'public' },
                '3-12': { name: 'Mawlid al-Nabi', nameAr: 'Mevlid Kandili', type: 'public' },
                '7-27': { name: 'Laylat al-Qadr', nameAr: 'Kadir Gecesi', type: 'public' },
                '9-1': { name: 'First Day of Ramadan', nameAr: 'Ramazan Başlangıcı', type: 'public' },
                '10-1': { name: 'Eid al-Fitr', nameAr: 'Ramazan Bayramı', type: 'public' },
                '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'Ramazan Bayramı (2. Gün)', type: 'public' },
                '10-3': { name: 'Eid al-Fitr (3rd Day)', nameAr: 'Ramazan Bayramı (3. Gün)', type: 'public' },
                '12-9': { name: 'Eid al-Adha', nameAr: 'Kurban Bayramı', type: 'public' },
                '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'Kurban Bayramı (2. Gün)', type: 'public' },
                '12-11': { name: 'Eid al-Adha (3rd Day)', nameAr: 'Kurban Bayramı (3. Gün)', type: 'public' },
                '12-12': { name: 'Eid al-Adha (4th Day)', nameAr: 'Kurban Bayramı (4. Gün)', type: 'public' }
            },
            // Pakistan
            'PK': {
                '1-1': { name: 'Islamic New Year', nameAr: 'نئے اسلامی سال کا دن', type: 'public' },
                '1-10': { name: 'Day of Ashura', nameAr: 'یوم عاشورہ', type: 'public' },
                '3-12': { name: 'Mawlid al-Nabi', nameAr: 'عید میلاد النبی', type: 'public' },
                '7-27': { name: 'Laylat al-Qadr', nameAr: 'لیلۃ القدر', type: 'public' },
                '9-1': { name: 'First Day of Ramadan', nameAr: 'رمضان کا پہلا دن', type: 'public' },
                '10-1': { name: 'Eid al-Fitr', nameAr: 'عید الفطر', type: 'public' },
                '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'عید الفطر (دوسرا دن)', type: 'public' },
                '10-3': { name: 'Eid al-Fitr (3rd Day)', nameAr: 'عید الفطر (تیسرا دن)', type: 'public' },
                '12-9': { name: 'Eid al-Adha', nameAr: 'عید الاضحیٰ', type: 'public' },
                '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'عید الاضحیٰ (دوسرا دن)', type: 'public' },
                '12-11': { name: 'Eid al-Adha (3rd Day)', nameAr: 'عید الاضحیٰ (تیسرا دن)', type: 'public' },
                '12-12': { name: 'Eid al-Adha (4th Day)', nameAr: 'عید الاضحیٰ (چوتھا دن)', type: 'public' }
            },
            // Malaysia
            'MY': {
                '1-1': { name: 'Islamic New Year', nameAr: 'Tahun Baru Hijrah', type: 'public' },
                '1-10': { name: 'Day of Ashura', nameAr: 'Hari Asyura', type: 'public' },
                '3-12': { name: 'Mawlid al-Nabi', nameAr: 'Maulidur Rasul', type: 'public' },
                '7-27': { name: 'Laylat al-Qadr', nameAr: 'Malam Lailatul Qadar', type: 'public' },
                '9-1': { name: 'First Day of Ramadan', nameAr: 'Hari Pertama Ramadan', type: 'public' },
                '10-1': { name: 'Eid al-Fitr', nameAr: 'Hari Raya Aidilfitri', type: 'public' },
                '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'Hari Raya Aidilfitri (Hari Kedua)', type: 'public' },
                '12-9': { name: 'Eid al-Adha', nameAr: 'Hari Raya Aidiladha', type: 'public' },
                '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'Hari Raya Aidiladha (Hari Kedua)', type: 'public' }
            },
            // Indonesia
            'ID': {
                '1-1': { name: 'Islamic New Year', nameAr: 'Tahun Baru Hijriyah', type: 'public' },
                '1-10': { name: 'Day of Ashura', nameAr: 'Hari Asyura', type: 'public' },
                '3-12': { name: 'Mawlid al-Nabi', nameAr: 'Maulid Nabi Muhammad', type: 'public' },
                '7-27': { name: 'Laylat al-Qadr', nameAr: 'Malam Lailatul Qadar', type: 'public' },
                '9-1': { name: 'First Day of Ramadan', nameAr: 'Hari Pertama Ramadan', type: 'public' },
                '10-1': { name: 'Eid al-Fitr', nameAr: 'Hari Raya Idul Fitri', type: 'public' },
                '10-2': { name: 'Eid al-Fitr (2nd Day)', nameAr: 'Hari Raya Idul Fitri (Hari Kedua)', type: 'public' },
                '12-9': { name: 'Eid al-Adha', nameAr: 'Hari Raya Idul Adha', type: 'public' },
                '12-10': { name: 'Eid al-Adha (2nd Day)', nameAr: 'Hari Raya Idul Adha (Hari Kedua)', type: 'public' }
            }
        };
    }

    // Convert Gregorian date to Hijri
    async convertToHijri(gregorianDate) {
        try {
            // Try online API first (with shorter timeout)
            const dateStr = gregorianDate.toISOString().split('T')[0];
            const response = await axios.get(`${this.hijriApiUrl}/${dateStr}`, {
                timeout: 2000 // 2 second timeout
            });

            if (response.data && response.data.data) {
                const hijri = response.data.data.hijri;
                return {
                    year: hijri.year,
                    month: hijri.month.number,
                    day: hijri.day,
                    monthName: hijri.month.en,
                    monthNameAr: hijri.month.ar,
                    dayName: hijri.weekday.en,
                    dayNameAr: hijri.weekday.ar,
                    designation: hijri.designation.abbreviated
                };
            }
        } catch (error) {
            // Fallback to offline library
            logger.info('Using offline Hijri conversion (API unavailable)');
        }
        
        // Fallback: Use offline moment-hijri library
        try {
            const dateStr = gregorianDate.toISOString().split('T')[0];
            const hijriMoment = moment(dateStr, 'YYYY-MM-DD');
            
            const monthNum = hijriMoment.iMonth() + 1; // 0-indexed, so +1
            
            return {
                year: hijriMoment.iYear(),
                month: monthNum,
                day: hijriMoment.iDate(),
                monthName: this.hijriMonthNames[monthNum - 1] || 'Unknown', // English month name from array
                monthNameAr: hijriMoment.format('iMMMM'), // Arabic month name (moment-hijri provides this)
                dayName: gregorianDate.toLocaleDateString('en-US', { weekday: 'long' }),
                dayNameAr: gregorianDate.toLocaleDateString('ar-SA', { weekday: 'long' }),
                designation: 'AH'
            };
        } catch (fallbackError) {
            logger.error('Error in offline Hijri conversion:', fallbackError);
        }
        
        return null;
    }

    // Get prayer times for a specific date and location
    async getPrayerTimes(date, latitude, longitude, country = 'AE') {
        try {
            const dateStr = date.toISOString().split('T')[0];
            const method = this.prayerCalculationMethods[country] || 4;

            const response = await axios.get(`${this.prayerTimesApiUrl}/${dateStr}`, {
                params: {
                    latitude,
                    longitude,
                    method: method,
                    school: 1 // Shafi (can be changed to 0 for Hanafi)
                }
            });

            if (response.data && response.data.data) {
                const timings = response.data.data.timings;
                return {
                    fajr: timings.Fajr,
                    sunrise: timings.Sunrise,
                    dhuhr: timings.Dhuhr,
                    asr: timings.Asr,
                    maghrib: timings.Maghrib,
                    isha: timings.Isha,
                    imsak: timings.Imsak,
                    midnight: timings.Midnight
                };
            }
            throw new Error('Invalid response from prayer times API');
        } catch (error) {
            logger.error('Error getting prayer times:', error);
            return null;
        }
    }

    // Get Islamic holidays for a specific date range
    async getIslamicHolidays(startDate, endDate, country = 'AE') {
        try {
            const holidays = [];
            const currentDate = new Date(startDate);
            const end = new Date(endDate);

            while (currentDate <= end) {
                const hijri = await this.convertToHijri(currentDate);
                if (hijri) {
                    const hijriKey = `${hijri.month}-${hijri.day}`;

                    // Check for global Islamic holidays
                    if (this.islamicHolidays[hijriKey]) {
                        const holiday = this.islamicHolidays[hijriKey];
                        holidays.push({
                            date: currentDate.toISOString().split('T')[0],
                            hijriDate: hijri,
                            name: holiday.name,
                            nameAr: holiday.nameAr,
                            type: holiday.type,
                            isPublic: false,
                            country: 'GLOBAL'
                        });
                    }

                    // Check for country-specific holidays
                    if (this.countryHolidays[country] && this.countryHolidays[country][hijriKey]) {
                        const holiday = this.countryHolidays[country][hijriKey];
                        holidays.push({
                            date: currentDate.toISOString().split('T')[0],
                            hijriDate: hijri,
                            name: holiday.name,
                            nameAr: holiday.nameAr,
                            type: holiday.type,
                            isPublic: holiday.type === 'public',
                            country: country
                        });
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            return holidays;
        } catch (error) {
            logger.error('Error getting Islamic holidays:', error);
            return [];
        }
    }

    // Get yearly holidays for a specific year and country
    async getYearlyHolidays(year, country = 'AE', includeIslamic = true, includeNational = true) {
        try {
            console.log(`🕌 [IslamicCalendarService] Getting yearly holidays for ${year}, country: ${country}`);
            
            const holidays = [];
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            
            // Get all Islamic holidays for the year
            if (includeIslamic) {
                const islamicHolidays = await this.getIslamicHolidays(yearStart, yearEnd, country);
                islamicHolidays.forEach(holiday => {
                    const hijriKey = `${holiday.hijriDate.month}-${holiday.hijriDate.day}`;
                    const duration = this.getHolidayDuration(hijriKey);
                    
                    holidays.push({
                        id: `${holiday.name.toLowerCase().replace(/\s+/g, '-')}-${year}`,
                        name: holiday.name,
                        nameAr: holiday.nameAr,
                        date: holiday.date,
                        hijriDate: hijriKey,
                        type: 'religious',
                        duration: duration,
                        country: country,
                        isPublic: holiday.isPublic
                    });
                });
            }
            
            // Get national holidays for the country
            if (includeNational && this.countryHolidays[country]) {
                const nationalHolidays = this.countryHolidays[country];
                Object.keys(nationalHolidays).forEach(hijriKey => {
                    const holiday = nationalHolidays[hijriKey];
                    if (holiday.type === 'national') {
                        // Convert Hijri date to Gregorian for the given year
                        const gregorianDate = this.convertHijriToGregorian(hijriKey, year);
                        if (gregorianDate) {
                            const duration = this.getHolidayDuration(hijriKey);
                            
                            holidays.push({
                                id: `${holiday.name.toLowerCase().replace(/\s+/g, '-')}-${year}`,
                                name: holiday.name,
                                nameAr: holiday.nameAr,
                                date: gregorianDate,
                                hijriDate: hijriKey,
                                type: 'national',
                                duration: duration,
                                country: country,
                                isPublic: true
                            });
                        }
                    }
                });
            }
            
            // Sort by date
            holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            console.log(`✅ [IslamicCalendarService] Found ${holidays.length} holidays for ${year}`);
            return holidays;
            
        } catch (error) {
            console.error('❌ [IslamicCalendarService] Error getting yearly holidays:', error);
            logger.error('Error getting yearly holidays:', error);
            return [];
        }
    }

    // Helper method to get holiday duration
    getHolidayDuration(hijriKey) {
        const multiDayHolidays = {
            '10-1': 3, // Eid al-Fitr
            '10-2': 3, // Eid al-Fitr (2nd Day)
            '10-3': 3, // Eid al-Fitr (3rd Day)
            '12-9': 4, // Eid al-Adha
            '12-10': 4, // Eid al-Adha (2nd Day)
            '12-11': 4, // Eid al-Adha (3rd Day)
            '12-12': 4, // Eid al-Adha (4th Day)
            '9-1': 30, // Ramadan
            '12-1': 2, // UAE National Day
            '12-2': 2, // UAE National Day (2nd Day)
            '2-22': 1  // Saudi National Day
        };
        return multiDayHolidays[hijriKey] || 1;
    }

    // Helper method to convert Hijri date to Gregorian
    convertHijriToGregorian(hijriKey, year) {
        try {
            const [hijriMonth, hijriDay] = hijriKey.split('-').map(Number);
            
            // Create a date in the middle of the year to avoid month boundary issues
            const midYear = new Date(year, 5, 15); // June 15th
            const hijriMoment = moment(midYear).iYear(year).iMonth(hijriMonth - 1).iDate(hijriDay);
            
            if (hijriMoment.isValid()) {
                return hijriMoment.format('YYYY-MM-DD');
            }
            return null;
        } catch (error) {
            console.error('Error converting Hijri to Gregorian:', error);
            return null;
        }
    }

    // Create prayer time events for a specific date
    async createPrayerTimeEvents(date, latitude, longitude, country = 'AE') {
        try {
            const prayerTimes = await this.getPrayerTimes(date, latitude, longitude, country);
            if (!prayerTimes) return [];

            const events = [];
            const dateStr = date.toISOString().split('T')[0];

            // Create events for each prayer time (excluding Sunrise as it's not a prayer)
            const prayers = [
                { name: 'Fajr', time: prayerTimes.fajr, color: '#2E7D32' },
                { name: 'Dhuhr', time: prayerTimes.dhuhr, color: '#1976D2' },
                { name: 'Asr', time: prayerTimes.asr, color: '#7B1FA2' },
                { name: 'Maghrib', time: prayerTimes.maghrib, color: '#D32F2F' },
                { name: 'Isha', time: prayerTimes.isha, color: '#424242' }
            ];

            for (const prayer of prayers) {
                const [time, period] = prayer.time.split(' ');
                const [hours, minutes] = time.split(':').map(Number);

                let eventDate = new Date(date);
                eventDate.setHours(hours, minutes, 0, 0);

                // Handle AM/PM conversion
                if (period === 'PM' && hours !== 12) {
                    eventDate.setHours(hours + 12);
                } else if (period === 'AM' && hours === 12) {
                    eventDate.setHours(0);
                }

                events.push({
                    title: `${prayer.name} Prayer`,
                    description: `Time for ${prayer.name} prayer`,
                    start: eventDate.toISOString(),
                    end: new Date(eventDate.getTime() + 30 * 60000).toISOString(), // 30 minutes duration
                    color: prayer.color,
                    category: 'prayer',
                    isIslamicEvent: true,
                    isRecurring: true,
                    recurrencePattern: 'daily'
                });
            }

            return events;
        } catch (error) {
            logger.error('Error creating prayer time events:', error);
            return [];
        }
    }

    // Get country code from user location or IP
    async getCountryCode(userLocation) {
        // This is a simplified version - in production, you'd use a proper geolocation service
        const countryMapping = {
            'United Arab Emirates': 'AE',
            'Saudi Arabia': 'SA',
            'Turkey': 'TR',
            'Pakistan': 'PK',
            'Malaysia': 'MY',
            'Indonesia': 'ID',
            'Egypt': 'EG',
            'Morocco': 'MA',
            'Algeria': 'DZ',
            'Tunisia': 'TN',
            'Libya': 'LY',
            'Kuwait': 'KW',
            'Qatar': 'QA',
            'Bahrain': 'BH',
            'Oman': 'OM'
        };

        return countryMapping[userLocation] || 'AE';
    }

    // Get all Islamic events for a month
    async getMonthlyIslamicEvents(year, month, latitude, longitude, country = 'AE') {
        try {
            console.log(`🕌 [IslamicCalendarService] Getting monthly events (holidays only) for ${year}-${month}`);
            
            // Use holiday aggregator to get holidays for the year
            const holidayAggregator = require('./holidayAggregatorService');
            console.log(`🕌 [IslamicCalendarService] Calling holiday aggregator for ${country} ${year}`);
            const allHolidays = await holidayAggregator.getHolidaysForCountry(
                country,
                year,
                ['islamic', 'religious', 'national', 'public', 'observance']
            );
            console.log(`🕌 [IslamicCalendarService] Holiday aggregator returned ${allHolidays.length} holidays`);
            console.log(`🕌 [IslamicCalendarService] Sample holidays:`, allHolidays.slice(0, 3).map(h => ({ name: h.name, date: h.date })));

            // Filter holidays for the specific month
            const monthHolidays = allHolidays.filter(holiday => {
                const holidayDate = new Date(holiday.date);
                const matches = holidayDate.getFullYear() === year && holidayDate.getMonth() === (month - 1);
                if (matches) {
                    console.log(`✅ Match found:`, { name: holiday.name, date: holiday.date, month: holidayDate.getMonth() + 1 });
                }
                return matches;
            });

            console.log(`🕌 [IslamicCalendarService] Found ${monthHolidays.length} holidays for ${year}-${month}`);

            // Transform to the expected format
            const holidays = monthHolidays.map(h => ({
                id: h.uniqueId,
                name: h.name,
                nameAr: h.nameAr || h.nameLocal,
                date: h.date,
                hijriDate: h.hijriDate,
                type: h.type,
                duration: h.duration || 1,
                country: h.countryCode,
                isPublic: h.isPublicHoliday,
                description: h.description
            }));

            // NOTE: Prayer events are now handled by the dedicated monthly-prayer-times endpoint
            // to avoid duplication. This endpoint only returns holidays.

            return {
                holidays,
                prayerEvents: [], // Empty - use /monthly-prayer-times endpoint instead
                totalEvents: holidays.length
            };
        } catch (error) {
            logger.error('Error getting monthly Islamic events:', error);
            return { holidays: [], prayerEvents: [], totalEvents: 0 };
        }
    }
}

module.exports = IslamicCalendarService;
