// translator-backend/__tests__/auth.test.js

const request = require('supertest');
const express = require('express');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// --- Import your routes and models ---
const authRoutes = require('../routes/authRoutes');
const errorHandler = require('../middleware/errorMiddleware');
const User = require('../models/User');

let mongoServer;
let app;

// --- Test Setup ---
beforeAll(async () => {
    // Manually set the environment variable for the test run.
    process.env.JWT_SECRET = 'a_secret_key_for_testing_purposes';

    // Start a new in-memory MongoDB server before all tests run
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect Mongoose to the in-memory server
    await mongoose.connect(mongoUri);

    // Create a minimal Express app for testing this specific route
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes); // Mount the routes we want to test
    app.use(errorHandler); // Include our error handler
});

// --- Test Teardown ---
afterAll(async () => {
    // Close the Mongoose connection
    await mongoose.disconnect();
    // Stop the in-memory MongoDB server
    await mongoServer.stop();
});

// --- Test Suite for Authentication ---
describe('Authentication API', () => {

    // Clear the users collection before each test to ensure isolation
    beforeEach(async () => {
        await User.deleteMany({});
    });

    // --- Registration Tests ---
    describe('POST /api/auth/register', () => {

        it('should register a new user successfully and return a token', async () => {
            const newUser = {
                email: 'test@example.com',
                username: 'testuser',
                password: 'Password123!@#',
            };

            const res = await request(app)
                .post('/api/auth/register')
                .send(newUser);

            expect(res.statusCode).toEqual(201);
            expect(res.body.msg).toBe('Registration successful! Please check your email to verify your account.');
            expect(res.body.requiresVerification).toBe(true);

            const userInDb = await User.findOne({ email: 'test@example.com' });
            expect(userInDb).not.toBeNull();
            expect(userInDb.username).toBe('testuser');
        });

        it('should return a 400 error if the user already exists', async () => {
            const existingUser = new User({ email: 'existing@example.com', password: 'Password123!@#', username: 'existinguser' });
            await existingUser.save();

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'existing@example.com',
                    username: 'anotheruser',
                    password: 'Password456!@#',
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toBe('User already exists with this email');
        });

        it('should return a 400 error if validation fails (e.g., invalid email)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'not-an-email',
                    username: 'testuser',
                    password: 'Password123!@#',
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors[0].msg).toBe('Please enter a valid email address');
        });
    });

    // --- Login Tests ---
    describe('POST /api/auth/login', () => {

        // Before each login test, create a user to log in with
        beforeEach(async () => {
            const user = new User({
                email: 'loginuser@example.com',
                username: 'loginuser',
                password: 'Password123!@#',
                isVerified: true, // Mark as verified for login tests
            });
            await user.save();
        });

        it('should log in an existing user successfully and return a token', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'loginuser@example.com',
                    password: 'Password123!@#', // Correct password
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.msg).toBe('Login successful');
        });

        it('should return a 400 error for a non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nouser@example.com',
                    password: 'Password123!@#',
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toBe('Invalid Credentials');
        });

        it('should return a 400 error for an incorrect password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'loginuser@example.com',
                    password: 'WrongPassword!@#', // Incorrect password
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toBe('Invalid Credentials');
        });
    });
});