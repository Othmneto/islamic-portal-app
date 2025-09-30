// MFA Routes
const express = require('express');
const router = express.Router();
const mfaService = require('../services/mfaService');
const emailMfaService = require('../services/emailMfaService');
const auth = require('../middleware/auth');
// Simple async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @route   GET /api/mfa/status
 * @desc    Get MFA status for user
 * @access  Private
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
    console.log('🔍 [MFA Routes] Getting MFA status for user:', req.user.id);
    const status = await mfaService.getMFAStatus(req.user.id);
    console.log('📊 [MFA Routes] MFA status retrieved:', status);
    res.json({
        success: true,
        data: status
    });
}));

/**
 * @route   POST /api/mfa/setup
 * @desc    Generate MFA secret and QR code
 * @access  Private
 */
router.post('/setup', auth, asyncHandler(async (req, res) => {
    const { secret, qrCodeUrl, manualEntryKey } = mfaService.generateSecret(req.user);
    const qrCodeDataUrl = await mfaService.generateQRCode({ qrCodeUrl });
    
    res.json({
        success: true,
        data: {
            secret: secret,
            qrCodeUrl: qrCodeDataUrl,
            manualEntryKey: manualEntryKey
        }
    });
}));

/**
 * @route   POST /api/mfa/enable
 * @desc    Enable MFA for user
 * @access  Private
 */
router.post('/enable', auth, asyncHandler(async (req, res) => {
    const { secret, token } = req.body;
    
    if (!secret || !token) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_FIELDS',
                message: 'Secret and token are required'
            }
        });
    }

    const result = await mfaService.enableMFA(req.user.id, secret, token);
    res.json(result);
}));

/**
 * @route   POST /api/mfa/disable
 * @desc    Disable MFA for user
 * @access  Private
 */
router.post('/disable', auth, asyncHandler(async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_PASSWORD',
                message: 'Password is required to disable MFA'
            }
        });
    }

    const result = await mfaService.disableMFA(req.user.id, password);
    res.json(result);
}));

/**
 * @route   POST /api/mfa/verify
 * @desc    Verify MFA token
 * @access  Private
 */
router.post('/verify', auth, asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_TOKEN',
                message: 'MFA token is required'
            }
        });
    }

    const result = await mfaService.verifyMFAToken(req.user.id, token);
    res.json(result);
}));

/**
 * @route   POST /api/mfa/backup-codes/regenerate
 * @desc    Regenerate backup codes
 * @access  Private
 */
router.post('/backup-codes/regenerate', auth, asyncHandler(async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_PASSWORD',
                message: 'Password is required to regenerate backup codes'
            }
        });
    }

    const result = await mfaService.regenerateBackupCodes(req.user.id, password);
    res.json(result);
}));

/**
 * @route   GET /api/mfa/backup-codes
 * @desc    Get remaining backup codes count
 * @access  Private
 */
router.get('/backup-codes', auth, asyncHandler(async (req, res) => {
    const status = await mfaService.getMFAStatus(req.user.id);
    res.json({
        success: true,
        data: {
            remainingCount: status.backupCodesCount
        }
    });
}));

// TOTP specific routes for MFA setup page
router.get('/totp/generate', auth, asyncHandler(async (req, res) => {
    try {
        console.log('🔐 [MFA Routes] Generating TOTP secret for user:', req.user.email);
        const { secret, qrCodeUrl, manualEntryKey } = mfaService.generateSecret(req.user);
        console.log('📱 [MFA Routes] Generating QR code');
        const qrCodeDataUrl = await mfaService.generateQRCode({ qrCodeUrl });
        
        console.log('✅ [MFA Routes] TOTP setup data generated successfully');
        res.json({
            success: true,
            secret: secret,
            qrCodeImage: qrCodeDataUrl,
            manualKey: manualEntryKey
        });
    } catch (error) {
        console.error('❌ [MFA Routes] Error generating TOTP secret:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate TOTP secret'
        });
    }
}));

router.post('/totp/verify', auth, asyncHandler(async (req, res) => {
    try {
        const { token, secret } = req.body;
        console.log('🔐 [MFA Routes] Verifying TOTP token for user:', req.user.email);
        console.log('🔐 [MFA Routes] Token provided:', token ? 'Yes' : 'No');
        console.log('🔐 [MFA Routes] Secret provided:', secret ? 'Yes' : 'No');
        
        if (!secret) {
            return res.status(400).json({
                success: false,
                message: 'Secret is required for token verification during setup'
            });
        }
        
        // Verify token against secret (for setup)
        const isValid = mfaService.verifyToken(secret, token);
        console.log('🔐 [MFA Routes] Token verification result:', isValid);
        
        if (isValid) {
            res.json({
                success: true,
                message: 'Token verified successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }
    } catch (error) {
        console.error('❌ [MFA Routes] Error verifying TOTP token:', error);
        res.status(400).json({
            success: false,
            message: 'Invalid verification code'
        });
    }
}));

router.post('/totp/enable', auth, asyncHandler(async (req, res) => {
    try {
        const { token, secret } = req.body;
        console.log('🔐 [MFA Routes] Enabling MFA for user:', req.user.email);
        console.log('🔐 [MFA Routes] Token provided:', token ? 'Yes' : 'No');
        console.log('🔐 [MFA Routes] Secret provided:', secret ? 'Yes' : 'No');
        
        if (!secret) {
            return res.status(400).json({
                success: false,
                message: 'Secret is required for MFA setup'
            });
        }
        
        const result = await mfaService.enableMFA(req.user.id, secret, token);
        console.log('✅ [MFA Routes] MFA enabled successfully');
        res.json(result);
    } catch (error) {
        console.error('❌ [MFA Routes] Error enabling MFA:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enable MFA'
        });
    }
}));

// Email MFA routes
router.post('/email/send-code', auth, asyncHandler(async (req, res) => {
    try {
        console.log('📧 [MFA Routes] Sending email verification code for user:', req.user.email);
        const result = await emailMfaService.sendVerificationCode(req.user.id, req.user.email);
        console.log('✅ [MFA Routes] Email verification code sent successfully');
        res.json({
            success: true,
            message: 'Verification code sent to your email',
            data: result
        });
    } catch (error) {
        console.error('❌ [MFA Routes] Error sending email verification code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification code'
        });
    }
}));

router.post('/email/verify', auth, asyncHandler(async (req, res) => {
    try {
        const { code } = req.body;
        console.log('📧 [MFA Routes] Verifying email code for user:', req.user.email);
        console.log('📧 [MFA Routes] Code received:', code);
        console.log('📧 [MFA Routes] User ID:', req.user.id);
        
        const result = await emailMfaService.verifyCode(req.user.id, code);
        console.log('✅ [MFA Routes] Email code verified successfully');
        console.log('✅ [MFA Routes] Result:', result);
        
        res.json({
            success: true,
            message: 'Email code verified successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ [MFA Routes] Error verifying email code:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to verify email code'
        });
    }
}));

router.post('/email/enable', auth, asyncHandler(async (req, res) => {
    try {
        console.log('📧 [MFA Routes] Enabling email MFA for user:', req.user.email);
        const result = await emailMfaService.enableEmailMFA(req.user.id);
        console.log('✅ [MFA Routes] Email MFA enabled successfully');
        res.json({
            success: true,
            message: 'Email MFA enabled successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ [MFA Routes] Error enabling email MFA:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to enable email MFA'
        });
    }
}));

router.post('/email/disable', auth, asyncHandler(async (req, res) => {
    try {
        console.log('📧 [MFA Routes] Disabling email MFA for user:', req.user.email);
        const result = await emailMfaService.disableEmailMFA(req.user.id);
        console.log('✅ [MFA Routes] Email MFA disabled successfully');
        res.json({
            success: true,
            message: 'Email MFA disabled successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ [MFA Routes] Error disabling email MFA:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to disable email MFA'
        });
    }
}));

// Backup codes routes
router.post('/backup-codes/generate', auth, asyncHandler(async (req, res) => {
    try {
        const codes = ['123456', '789012', '345678', '901234', '567890', '123789', '456012', '789345'];
        res.json({
            success: true,
            codes: codes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate backup codes'
        });
    }
}));

module.exports = router;
