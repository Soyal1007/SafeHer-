const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    displayName: { type: String, default: 'Anonymous Guardian' },
    isAvailable: { type: Boolean, default: true },
    lastLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0,0] } // [longitude, latitude]
    },
    emergencyContacts: [{
        name: String,
        phone: String
    }],
    activeAlert: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.index({ lastLocation: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
