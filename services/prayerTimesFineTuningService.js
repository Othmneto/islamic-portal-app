/**
 * Prayer Times Fine-Tuning Service
 * Loads and applies region-specific adjustments based on official Islamic authorities
 */

const fs = require('fs').promises;
const path = require('path');

class PrayerTimesFineTuningService {
  constructor() {
    this.fineTuningData = null;
    this.dataPath = path.join(__dirname, '../data/prayer-times-fine-tuning.json');
  }

  /**
   * Load fine-tuning data from JSON file
   */
  async loadFineTuningData() {
    try {
      if (this.fineTuningData) {
        return this.fineTuningData;
      }

      const data = await fs.readFile(this.dataPath, 'utf8');
      this.fineTuningData = JSON.parse(data);
      console.log(`[FineTuning] Loaded ${Object.keys(this.fineTuningData.regions).length} regions`);
      return this.fineTuningData;
    } catch (error) {
      console.error('[FineTuning] Failed to load fine-tuning data:', error);
      return null;
    }
  }

  /**
   * Detect region based on coordinates
   */
  async detectRegion(lat, lon) {
    const data = await this.loadFineTuningData();
    if (!data) return null;

    // Check each region's coordinates
    for (const [regionKey, regionData] of Object.entries(data.regions)) {
      const coords = regionData.coordinates;
      if (
        lat >= coords.latMin &&
        lat <= coords.latMax &&
        lon >= coords.lonMin &&
        lon <= coords.lonMax
      ) {
        console.log(`[FineTuning] Detected region: ${regionData.name} (${regionKey})`);
        return { key: regionKey, ...regionData };
      }
    }

    console.log('[FineTuning] No specific region detected, using default');
    return null;
  }

  /**
   * Get fine-tuning adjustments for a location
   */
  async getAdjustments(lat, lon) {
    const region = await this.detectRegion(lat, lon);
    if (!region) {
      return {
        fajr: 0,
        shuruq: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0
      };
    }

    console.log(`[FineTuning] Using adjustments for ${region.name}:`, region.adjustments);
    return {
      ...region.adjustments,
      regionName: region.name,
      authority: region.authority,
      calculationMethod: region.calculationMethod,
      madhab: region.madhab
    };
  }

  /**
   * Apply adjustments to prayer times
   */
  applyAdjustments(times, adjustments) {
    if (!times || !adjustments) return times;

    const adjusted = { ...times };

    // Apply each adjustment (in minutes)
    for (const [prayer, minutes] of Object.entries(adjustments)) {
      if (adjusted[prayer] && typeof minutes === 'number') {
        const date = new Date(adjusted[prayer]);
        date.setMinutes(date.getMinutes() + minutes);
        adjusted[prayer] = date.toISOString();
      }
    }

    return adjusted;
  }

  /**
   * Get recommended calculation method for a location
   */
  async getRecommendedMethod(lat, lon) {
    const region = await this.detectRegion(lat, lon);
    return region ? region.calculationMethod : 'MuslimWorldLeague';
  }

  /**
   * Get recommended madhab for a location
   */
  async getRecommendedMadhab(lat, lon) {
    const region = await this.detectRegion(lat, lon);
    return region ? region.madhab : 'Shafi';
  }

  /**
   * Get region information for a location
   */
  async getRegionInfo(lat, lon) {
    const region = await this.detectRegion(lat, lon);
    if (!region) {
      return {
        name: 'Unknown Region',
        authority: 'Muslim World League',
        calculationMethod: 'MuslimWorldLeague',
        madhab: 'Shafi',
        notes: 'Using default calculation method'
      };
    }

    return {
      name: region.name,
      authority: region.authority,
      calculationMethod: region.calculationMethod,
      madhab: region.madhab,
      notes: region.notes
    };
  }

  /**
   * Update adjustments for a region (admin function)
   */
  async updateRegionAdjustments(regionKey, adjustments, adminNotes) {
    try {
      const data = await this.loadFineTuningData();
      if (!data || !data.regions[regionKey]) {
        throw new Error(`Region ${regionKey} not found`);
      }

      // Update adjustments
      data.regions[regionKey].adjustments = adjustments;

      // Update admin notes
      if (adminNotes) {
        data.adminNotes.lastVerified[regionKey] = new Date().toISOString().split('T')[0];
      }

      // Save back to file
      await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2), 'utf8');

      // Clear cache to force reload
      this.fineTuningData = null;

      console.log(`[FineTuning] Updated adjustments for ${regionKey}`);
      return true;
    } catch (error) {
      console.error('[FineTuning] Failed to update adjustments:', error);
      return false;
    }
  }

  /**
   * Get all regions (for admin panel)
   */
  async getAllRegions() {
    const data = await this.loadFineTuningData();
    return data ? data.regions : {};
  }

  /**
   * Get admin notes
   */
  async getAdminNotes() {
    const data = await this.loadFineTuningData();
    return data ? data.adminNotes : {};
  }
}

// Export singleton instance
module.exports = new PrayerTimesFineTuningService();


