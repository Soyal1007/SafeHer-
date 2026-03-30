const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    eventType: { type: String, enum: ['AUDIO_SPIKE', 'MOTION_SPIKE', 'MANUAL_SOS'], required: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } 
    },
    status: { type: String, enum: ['PENDING_CONFIRMATION', 'ACTIVE', 'RESOLVED', 'FALSE_ALARM'], default: 'PENDING_CONFIRMATION' },
    audioClipUrl: { type: String }, // optional storage reference
    verified: { type: Boolean, default: false }
}, { timestamps: true });

eventSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Event', eventSchema);
