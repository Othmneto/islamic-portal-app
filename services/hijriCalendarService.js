// services/hijriCalendarService.js - Complete Hijri Calendar Integration

const axios = require('axios');

class HijriCalendarService {
    constructor() {
        this.apiKey = process.env.ALADHAN_API_KEY || 'your-api-key';
        this.baseUrl = 'http://api.aladhan.com/v1';
        this.islamicHolidays = this.getIslamicHolidays();
    }

    // Get Islamic holidays for the year
    getIslamicHolidays() {
        return {
            // Fixed Islamic holidays (approximate dates)
            '01-01': { name: 'Islamic New Year', arabic: 'رأس السنة الهجرية', type: 'religious' },
            '01-10': { name: 'Day of Ashura', arabic: 'عاشوراء', type: 'religious' },
            '03-12': { name: 'Mawlid al-Nabi', arabic: 'المولد النبوي', type: 'religious' },
            '07-27': { name: 'Laylat al-Qadr', arabic: 'ليلة القدر', type: 'religious' },
            '09-01': { name: 'Ramadan Begins', arabic: 'بداية رمضان', type: 'religious' },
            '10-01': { name: 'Eid al-Fitr', arabic: 'عيد الفطر', type: 'religious' },
            '12-08': { name: 'Hajj Begins', arabic: 'بداية الحج', type: 'religious' },
            '12-09': { name: 'Day of Arafat', arabic: 'يوم عرفة', type: 'religious' },
            '12-10': { name: 'Eid al-Adha', arabic: 'عيد الأضحى', type: 'religious' }
        };
    }

    // Convert Gregorian date to Hijri
    async convertToHijri(gregorianDate) {
        try {
            const dateStr = gregorianDate.toISOString().split('T')[0];
            console.log(`🌙 [Hijri Service] Converting date: ${dateStr}`);

            // Try the primary API first
            const response = await axios.get(`${this.baseUrl}/gToH/${dateStr}`, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.data) {
                const hijri = response.data.data;
                console.log(`✅ [Hijri Service] API conversion successful: ${hijri.year}/${hijri.month.number}/${hijri.day}`);
                return {
                    year: hijri.year,
                    month: hijri.month.number,
                    day: hijri.day,
                    monthName: hijri.month.name,
                    monthNameArabic: hijri.month.ar,
                    dayName: hijri.weekday.name,
                    dayNameArabic: hijri.weekday.ar,
                    isHoliday: this.isIslamicHoliday(hijri.month.number, hijri.day),
                    holiday: this.getHolidayInfo(hijri.month.number, hijri.day)
                };
            }
        } catch (error) {
            console.error('❌ [Hijri Service] Error converting to Hijri:', error.message);
            console.log('🔄 [Hijri Service] Using fallback calculation...');
            return this.getFallbackHijri(gregorianDate);
        }
    }

    // Convert Hijri date to Gregorian
    async convertToGregorian(hijriYear, hijriMonth, hijriDay) {
        try {
            const response = await axios.get(`${this.baseUrl}/hToG/${hijriDay}/${hijriMonth}/${hijriYear}`);

            if (response.data && response.data.data) {
                const gregorian = response.data.data;
                return new Date(gregorian.year, gregorian.month - 1, gregorian.day);
            }
        } catch (error) {
            console.error('❌ [Hijri Service] Error converting to Gregorian:', error.message);
            return new Date();
        }
    }

    // Get current Hijri date
    async getCurrentHijriDate() {
        return await this.convertToHijri(new Date());
    }

    // Get Hijri calendar for a specific month
    async getHijriMonth(year, month) {
        try {
            const response = await axios.get(`${this.baseUrl}/gToHCalendar/${month}/${year}`);

            if (response.data && response.data.data) {
                return response.data.data.map(day => ({
                    gregorian: new Date(day.gregorian.year, day.gregorian.month - 1, day.gregorian.day),
                    hijri: {
                        year: day.hijri.year,
                        month: day.hijri.month.number,
                        day: day.hijri.day,
                        monthName: day.hijri.month.name,
                        monthNameArabic: day.hijri.month.ar,
                        dayName: day.hijri.weekday.name,
                        dayNameArabic: day.hijri.weekday.ar
                    },
                    isHoliday: this.isIslamicHoliday(day.hijri.month.number, day.hijri.day),
                    holiday: this.getHolidayInfo(day.hijri.month.number, day.hijri.day)
                }));
            }
        } catch (error) {
            console.error('❌ [Hijri Service] Error getting Hijri month:', error.message);
            return [];
        }
    }

    // Check if date is an Islamic holiday
    isIslamicHoliday(month, day) {
        const key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return this.islamicHolidays.hasOwnProperty(key);
    }

    // Get holiday information
    getHolidayInfo(month, day) {
        const key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return this.islamicHolidays[key] || null;
    }

    // Get Islamic months
    getIslamicMonths() {
        return [
            { number: 1, name: 'Muharram', arabic: 'محرم' },
            { number: 2, name: 'Safar', arabic: 'صفر' },
            { number: 3, name: 'Rabi\' al-awwal', arabic: 'ربيع الأول' },
            { number: 4, name: 'Rabi\' al-thani', arabic: 'ربيع الثاني' },
            { number: 5, name: 'Jumada al-awwal', arabic: 'جمادى الأولى' },
            { number: 6, name: 'Jumada al-thani', arabic: 'جمادى الثانية' },
            { number: 7, name: 'Rajab', arabic: 'رجب' },
            { number: 8, name: 'Sha\'ban', arabic: 'شعبان' },
            { number: 9, name: 'Ramadan', arabic: 'رمضان' },
            { number: 10, name: 'Shawwal', arabic: 'شوال' },
            { number: 11, name: 'Dhu al-Qi\'dah', arabic: 'ذو القعدة' },
            { number: 12, name: 'Dhu al-Hijjah', arabic: 'ذو الحجة' }
        ];
    }

    // Get prayer times for a specific date and location
    async getPrayerTimes(date, latitude, longitude) {
        try {
            const dateStr = date.toISOString().split('T')[0];
            const response = await axios.get(`${this.baseUrl}/timings/${dateStr}`, {
                params: {
                    latitude: latitude,
                    longitude: longitude,
                    method: 2, // Islamic Society of North America
                    school: 1  // Shafi
                }
            });

            if (response.data && response.data.data) {
                const timings = response.data.data.timings;
                return {
                    fajr: timings.Fajr,
                    dhuhr: timings.Dhuhr,
                    asr: timings.Asr,
                    maghrib: timings.Maghrib,
                    isha: timings.Isha,
                    sunrise: timings.Sunrise,
                    sunset: timings.Sunset,
                    hijriDate: response.data.data.date.hijri
                };
            }
        } catch (error) {
            console.error('❌ [Hijri Service] Error getting prayer times:', error.message);
            return null;
        }
    }

    // Get Qibla direction
    async getQiblaDirection(latitude, longitude) {
        try {
            const response = await axios.get(`${this.baseUrl}/qibla/${latitude}/${longitude}`);

            if (response.data && response.data.data) {
                return {
                    direction: response.data.data.direction,
                    degrees: response.data.data.degrees
                };
            }
        } catch (error) {
            console.error('❌ [Hijri Service] Error getting Qibla direction:', error.message);
            return null;
        }
    }

    // Fallback Hijri calculation (approximate)
    getFallbackHijri(gregorianDate) {
        try {
            console.log('🔄 [Hijri Service] Using fallback calculation for date:', gregorianDate);

            // More accurate approximation using known reference points
            const hijriEpoch = new Date(622, 6, 16); // July 16, 622 CE
            const daysSinceEpoch = Math.floor((gregorianDate - hijriEpoch) / (1000 * 60 * 60 * 24));

            // Use more accurate conversion factors
            const hijriYear = Math.floor(daysSinceEpoch / 354.37) + 1;
            const hijriMonth = Math.floor((daysSinceEpoch % 354.37) / 29.53) + 1;
            const hijriDay = Math.floor((daysSinceEpoch % 29.53)) + 1;

            // Ensure valid ranges
            const validMonth = Math.max(1, Math.min(12, hijriMonth));
            const validDay = Math.max(1, Math.min(30, hijriDay));

            const months = this.getIslamicMonths();
            const monthInfo = months[validMonth - 1] || months[0];

            const result = {
                year: hijriYear,
                month: validMonth,
                day: validDay,
                monthName: monthInfo.name,
                monthNameArabic: monthInfo.arabic,
                dayName: 'Unknown',
                dayNameArabic: 'غير معروف',
                isHoliday: this.isIslamicHoliday(validMonth, validDay),
                holiday: this.getHolidayInfo(validMonth, validDay)
            };

            console.log(`✅ [Hijri Service] Fallback calculation result: ${result.year}/${result.month}/${result.day}`);
            return result;
        } catch (error) {
            console.error('❌ [Hijri Service] Error in fallback calculation:', error.message);
            // Return a basic fallback
            return {
                year: 1447,
                month: 4,
                day: 24,
                monthName: "Rabi' al-thani",
                monthNameArabic: 'ربيع الثاني',
                dayName: 'Unknown',
                dayNameArabic: 'غير معروف',
                isHoliday: false,
                holiday: null
            };
        }
    }

    // Get Ramadan information
    async getRamadanInfo(year) {
        try {
            // Get approximate Ramadan dates
            const ramadanStart = await this.convertToGregorian(year, 9, 1);
            const ramadanEnd = await this.convertToGregorian(year, 10, 1);

            return {
                start: ramadanStart,
                end: ramadanEnd,
                duration: Math.ceil((ramadanEnd - ramadanStart) / (1000 * 60 * 60 * 24))
            };
        } catch (error) {
            console.error('❌ [Hijri Service] Error getting Ramadan info:', error.message);
            return null;
        }
    }
}

module.exports = new HijriCalendarService();
