const axios = require('axios');
const { logger } = require('../config/logger');

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
            const dateStr = gregorianDate.toISOString().split('T')[0];
            const response = await axios.get(`${this.hijriApiUrl}/${dateStr}`);
            
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
            throw new Error('Invalid response from Hijri API');
        } catch (error) {
            logger.error('Error converting to Hijri:', error);
            return null;
        }
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

    // Create prayer time events for a specific date
    async createPrayerTimeEvents(date, latitude, longitude, country = 'AE') {
        try {
            const prayerTimes = await this.getPrayerTimes(date, latitude, longitude, country);
            if (!prayerTimes) return [];

            const events = [];
            const dateStr = date.toISOString().split('T')[0];

            // Create events for each prayer time
            const prayers = [
                { name: 'Fajr', time: prayerTimes.fajr, color: '#2E7D32' },
                { name: 'Sunrise', time: prayerTimes.sunrise, color: '#FF9800' },
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
            console.log(`🕌 [IslamicCalendarService] Getting monthly events for ${year}-${month}`);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            const holidays = await this.getIslamicHolidays(startDate, endDate, country);
            console.log(`🕌 [IslamicCalendarService] Found ${holidays.length} holidays`);
            
            // Create prayer events for the entire month
            const prayerEvents = [];
            const daysInMonth = new Date(year, month, 0).getDate();
            
            for (let day = 1; day <= daysInMonth; day++) {
                try {
                    const date = new Date(year, month - 1, day);
                    const dayPrayerEvents = await this.createPrayerTimeEvents(date, latitude, longitude, country);
                    prayerEvents.push(...dayPrayerEvents);
                } catch (error) {
                    console.error(`Error creating prayer events for ${year}-${month}-${day}:`, error.message);
                }
            }
            
            console.log(`🕌 [IslamicCalendarService] Created ${prayerEvents.length} prayer events`);

            return {
                holidays,
                prayerEvents,
                totalEvents: holidays.length + prayerEvents.length
            };
        } catch (error) {
            logger.error('Error getting monthly Islamic events:', error);
            return { holidays: [], prayerEvents: [], totalEvents: 0 };
        }
    }
}

module.exports = IslamicCalendarService;
