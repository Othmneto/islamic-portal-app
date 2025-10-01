const { validationResult } = require('express-validator');
const TranslationHistory = require('../models/TranslationHistory');
const translationEngine = require('../translationEngineImproved');

/**
 * Translate text from source language to target language
 * POST /api/text-translation/translate
 */
exports.translate = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: errors.array()[0].msg 
      });
    }

    const { sourceText, sourceLanguage, targetLanguage } = req.body;

    // Additional validation
    if (!sourceText || sourceText.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Source text cannot be empty' 
      });
    }

    if (sourceText.length > 5000) {
      return res.status(400).json({ 
        success: false,
        error: 'Source text is too long. Maximum 5000 characters allowed.' 
      });
    }

    if (sourceLanguage === targetLanguage) {
      return res.status(400).json({ 
        success: false,
        error: 'Source and target languages must be different' 
      });
    }

    // Perform translation
    const result = await translationEngine.translate(sourceText, sourceLanguage, targetLanguage);
    
    if (!result || !result.translatedText) {
      // Log failed translation attempt
      await logTranslationAttempt(req, {
        text: sourceText,
        sourceLang: sourceLanguage,
        targetLang: targetLanguage,
        error: 'Translation engine returned empty result'
      });

      return res.status(400).json({ 
        success: false,
        error: 'Translation failed. Please try again with different text or check your language selection.',
        details: result?.details || null
      });
    }

    // Check if translation has error details
    if (result.error) {
      console.error('[TranslationController] Translation error:', result.error);
      console.error('[TranslationController] Error details:', result.details);
      
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        translatedText: result.translatedText // Include the fallback text
      });
    }

    // Log successful translation
    await logTranslationSuccess(req, {
      from: sourceLanguage,
      to: targetLanguage,
      original: sourceText,
      translatedText: result.translatedText
    });

    res.json({
      success: true,
      translatedText: result.translatedText,
      from: sourceLanguage,
      to: targetLanguage,
      original: sourceText,
      confidence: result.confidence || null,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[Translation] Error:', err);
    
    // Log error
    await logTranslationAttempt(req, {
      text: req.body.sourceText || '',
      sourceLang: req.body.sourceLanguage || '',
      targetLang: req.body.targetLanguage || '',
      error: err.message
    });

    res.status(500).json({ 
      success: false,
      error: 'Internal server error. Please try again later.' 
    });
  }
};

/**
 * Get translation history for user
 * GET /api/text-translation/history
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const history = await TranslationHistory.find({ userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await TranslationHistory.countDocuments({ userId });

    res.json({
      success: true,
      data: history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('[Translation History] Error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve translation history' 
    });
  }
};

/**
 * Export translation history as PDF
 * GET /api/text-translation/export/pdf
 */
exports.exportPDF = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const userId = req.user?.id || 'anonymous';
    
    const history = await TranslationHistory.find({ 
      userId,
      error: { $exists: false } // Only successful translations
    })
    .sort({ timestamp: -1 })
    .limit(100);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="translation-history.pdf"');
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Translation History', 50, 50);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, 50, 80);
    doc.text(`Total Translations: ${history.length}`, 50, 100);
    
    let yPosition = 130;

    // Content
    history.forEach((entry, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(14).text(`Translation ${index + 1}`, 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(10).text(`From: ${entry.from} → To: ${entry.to}`, 50, yPosition);
      yPosition += 15;
      
      doc.text(`Date: ${entry.timestamp.toLocaleString()}`, 50, yPosition);
      yPosition += 15;
      
      doc.text('Original:', 50, yPosition);
      yPosition += 15;
      doc.text(entry.original, 70, yPosition, { width: 500 });
      yPosition += 30;
      
      doc.text('Translated:', 50, yPosition);
      yPosition += 15;
      doc.text(entry.translated, 70, yPosition, { width: 500 });
      yPosition += 40;
      
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 20;
    });

    doc.end();

  } catch (err) {
    console.error('[PDF Export] Error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate PDF export' 
    });
  }
};

/**
 * Get translation statistics
 * GET /api/text-translation/stats
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    
    const totalTranslations = await TranslationHistory.countDocuments({ userId });
    const successfulTranslations = await TranslationHistory.countDocuments({ 
      userId, 
      error: { $exists: false } 
    });
    const failedTranslations = await TranslationHistory.countDocuments({ 
      userId, 
      error: { $exists: true } 
    });

    // Language pair statistics
    const languageStats = await TranslationHistory.aggregate([
      { $match: { userId, error: { $exists: false } } },
      { $group: { 
        _id: { from: '$from', to: '$to' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Daily translation count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyStats = await TranslationHistory.aggregate([
      { 
        $match: { 
          userId, 
          timestamp: { $gte: thirtyDaysAgo },
          error: { $exists: false }
        } 
      },
      { 
        $group: { 
          _id: { 
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          }, 
          count: { $sum: 1 } 
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalTranslations,
        successfulTranslations,
        failedTranslations,
        successRate: totalTranslations > 0 ? (successfulTranslations / totalTranslations * 100).toFixed(2) : 0,
        languagePairs: languageStats,
        dailyActivity: dailyStats
      }
    });

  } catch (err) {
    console.error('[Translation Stats] Error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve translation statistics' 
    });
  }
};

/**
 * Log translation attempt (success or failure)
 */
async function logTranslationAttempt(req, data) {
  try {
    await TranslationHistory.create({
      userId: req.user?.id || 'anonymous',
      from: data.sourceLang,
      to: data.targetLang,
      original: data.text,
      translated: data.translatedText || null,
      error: data.error || null,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[Translation Logging] Error:', err);
  }
}

/**
 * Log successful translation
 */
async function logTranslationSuccess(req, data) {
  try {
    await TranslationHistory.create({
      userId: req.user?.id || 'anonymous',
      from: data.from,
      to: data.to,
      original: data.original,
      translated: data.translatedText,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[Translation Logging] Error:', err);
  }
}
