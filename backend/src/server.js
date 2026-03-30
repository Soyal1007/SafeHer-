const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.json());

// Skip ngrok browser warning on all devices (especially mobile)
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// Main HTML Static Route - serve all pages
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Connect to MongoDB
const mongoConnected = mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zenz', {
  serverSelectionTimeoutMS: 5000
}).then(() => {
    console.log('✅ MongoDB Connected');
    return true;
}).catch(err => {
    console.log('⚠️ MongoDB Offline: Running in "Demo Mode" (Mocks Active)');
    return false;
});

// Demo Mode Middleware: Intercept API calls if Database is offline
app.use(async (req, res, next) => {
    const isConnected = await mongoConnected;
    if (!isConnected && (req.path.startsWith('/api/users') || req.path.startsWith('/api/events'))) {
        console.log(`[DemoMode] Mocking ${req.method} ${req.path}`);
        if (req.path === '/api/users/auth') return res.json({ success: true, user: { deviceId: 'demo_user' } });
        if (req.path === '/api/users/location') return res.json({ success: true });
        if (req.path === '/api/users/nearby') return res.json({ success: true, users: [] });
        if (req.path === '/api/events/trigger') return res.json({ success: true, message: 'Mock event triggered' });
        if (req.path === '/api/events/cancel') return res.json({ success: true, message: 'Mock event cancelled' });
        if (req.path === '/api/events/distress-detect') return res.json({ success: true, eventId: 'mock_id' });
    }
    next();
});


// Routes
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const routeRoutes = require('./routes/routing');

app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/emergency', require('./routes/emergency'));

// Socket.io Config
require('./sockets')(io);

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ZenZ Server running on port ${PORT}`);
});
