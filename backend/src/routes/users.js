const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/auth', async (req, res) => {
    try {
        const { deviceId } = req.body;
        let user = await User.findOne({ deviceId });
        if (!user) {
            user = new User({ deviceId });
            await user.save();
        }
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/location', async (req, res) => {
    try {
        const { deviceId, coordinates } = req.body;
        await User.findOneAndUpdate({ deviceId }, { 
            lastLocation: { type: 'Point', coordinates } 
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/nearby', async (req, res) => {
    try {
        const { lon, lat, radius = 5000 } = req.query; // maxDistance is in meters
        if (!lon || !lat) return res.status(400).json({ error: 'Missing coordinates' });

        const users = await User.find({
            lastLocation: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lon), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        });
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
