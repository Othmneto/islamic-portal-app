const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/authMiddleware');

// Session heartbeat - renews cookie and confirms session validity
router.post('/api/session/heartbeat', attachUser, (req, res) => {
    if (req.user) {
        // Touch session to renew cookie
        req.session.touch();
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                username: req.user.username
            },
            expiresAt: req.session.cookie.expires
        });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated' });
    }
});

module.exports = router;
