const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');

// Endpoint: Layer 1 & 2 detection (Sensor anomalies)
router.post('/distress-detect', async (req, res) => {
    try {
        const { deviceId, type, coordinates } = req.body;
        // Verify User
        let user = await User.findOne({ deviceId });
        if (!user) {
            user = new User({ deviceId, lastLocation: { coordinates } });
            await user.save();
        }

        // Create an Event Pending Confirmation
        const newEvent = new Event({
            userId: user._id,
            eventType: type,
            status: 'PENDING_CONFIRMATION',
            location: { coordinates }
        });
        await newEvent.save();

        res.json({ success: true, eventId: newEvent._id, message: 'Event logged waiting layer 3' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Endpoint: Layer 3 Trigger (Real-Time escalation)
router.post('/trigger', async (req, res) => {
    try {
        const { eventId, deviceId, coordinates } = req.body;
        let pEvent;
        
        if (eventId) {
            pEvent = await Event.findById(eventId);
            if (pEvent) {
                pEvent.status = 'ACTIVE';
                pEvent.verified = true;
                await pEvent.save();
            }
        } else if (deviceId) {
            let user = await User.findOne({ deviceId });
            pEvent = new Event({
                userId: user?._id,
                eventType: 'MANUAL_SOS',
                status: 'ACTIVE',
                verified: true,
                location: { coordinates }
            });
            await pEvent.save();
            if (user) {
                user.activeAlert = true;
                await user.save();
            }
        }

        // Simulate Twilio SMS
        console.log(`[TWILIO MOCK] 🚨 SMS Sent to Emergency Contacts. Location: ${coordinates}`);

        // Since we are inside Express and Socket.io is attached to the app via another process
        // We will just return success and let the client emit the websocket event to broadcast
        res.json({ success: true, message: 'Emergency escalation triggered', activeEvent: pEvent });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Resolve alert
router.post('/cancel', async (req, res) => {
    try {
        const { eventId, deviceId } = req.body;
        if (eventId) {
            await Event.findByIdAndUpdate(eventId, { status: 'FALSE_ALARM' });
        }
        if (deviceId) {
            await User.findOneAndUpdate({ deviceId }, { activeAlert: false });
        }
        res.json({ success: true, message: 'Alert cancelled' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
