const adhan = require('adhan');
const coords = new adhan.Coordinates(25.2643, 55.3218);
const date = new Date('2025-10-13');

console.log('Testing Umm al-Qura parameters for Dubai, 2025-10-13:');

const method = adhan.CalculationMethod.UmmAlQura();
console.log('Default Umm al-Qura Fajr angle:', method.getParameters().fajrAngle);
console.log('Default Umm al-Qura Isha angle:', method.getParameters().ishaAngle);

// Test with different fajr angles
for (let angle = 17.5; angle <= 19.5; angle += 0.5) {
  const customMethod = adhan.CalculationMethod.UmmAlQura();
  customMethod.getParameters().fajrAngle = angle;
  const pt = new adhan.PrayerTimes(coords, date, customMethod);
  console.log(`Fajr with ${angle}°: ${pt.fajr.toLocaleTimeString()}`);
}

// Test different high latitude rules
const rules = ['middleOfTheNight', 'seventhOfTheNight', 'twilightAngle'];
rules.forEach(rule => {
  const method = adhan.CalculationMethod.UmmAlQura();
  method.getParameters().highLatRule = adhan.HighLatitudeRule[rule];
  const pt = new adhan.PrayerTimes(coords, date, method);
  console.log(`Fajr with ${rule}: ${pt.fajr.toLocaleTimeString()}`);
});

