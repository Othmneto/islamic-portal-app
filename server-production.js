// Production-Grade Server Configuration with Enhanced Security
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { env } = require('./config');

// Import enhanced security middleware
const { securityHeaders, customSecurityHeaders, securityEventLogger } = require('./middleware/enhancedSecurityHeaders');
const { 
    loginLimiter, 
    registrationLimiter, 
    passwordResetLimiter, 
    apiLimiter, 
    strictLimiter 
} = require('./middleware/enhancedRateLimiting');

// Import enhanced authentication
const enhancedAuth = require('./middleware/enhancedAuth');
const enhancedAuthController = require('./controllers/enhancedAuthController');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Enhanced security headers
app.use(securityHeaders);
app.use(customSecurityHeaders);
app.use(securityEventLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = (env.CORS_ORIGINS || env.CLIENT_ORIGIN || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Session configuration with enhanced security
app.use(session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: env.MONGODB_URI,
        touchAfter: 24 * 3600, // lazy session update
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native',
        autoRemoveInterval: 10, // check every 10 minutes
        stringify: false
    }),
    cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        sameSite: 'strict'
    },
    name: 'sessionId' // Don't use default 'connect.sid'
}));

// Rate limiting
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registrationLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/', apiLimiter);

// Static files with security headers
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        }
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API routes with enhanced security
app.use('/api/auth', authRoutes);
app.use('/api/user', enhancedAuth, userRoutes);
app.use('/api/', apiRoutes);

// Enhanced OAuth routes
const enhancedOAuth = require('./routes/enhancedOAuth');
app.use('/api/auth/oauth', enhancedOAuth);

// CSRF protection
const { issueCsrfToken, verifyCsrf } = require('./middleware/csrfMiddleware');
app.use('/api/auth', issueCsrfToken);
app.get('/api/auth/csrf', (req, res) => {
    res.json({ ok: true, csrfToken: req.csrfToken() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message
        },
        requestId: req.id || 'unknown'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Resource not found'
        },
        requestId: req.id || 'unknown'
    });
});

// Database connection
mongoose.connect(env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    bufferMaxEntries: 0
}).then(() => {
    console.log('✅ Connected to MongoDB');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
    });
});

// Start server
const PORT = env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Production server running on port ${PORT}`);
    console.log(`🔒 Enhanced security features enabled`);
    console.log(`📊 Environment: ${env.NODE_ENV}`);
    console.log(`🌐 CORS origins: ${env.CORS_ORIGINS || 'default'}`);
});

module.exports = app;
