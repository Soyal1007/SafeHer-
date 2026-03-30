const User = require('../models/User');
const Event = require('../models/Event');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Client Connected: ${socket.id}`);

        socket.on('register_device', async ({ deviceId }) => {
            if(!deviceId) return;
            socket.join(deviceId);
            // Link socketId to User possibly if advanced tracking needed
            console.log(`📱 Device registered for sockets: ${deviceId}`);
        });

        // 🚨 Broadcast Emergency Event
        socket.on('emergency_broadcast', async (data) => {
            console.log(`\n🔴 EMERGENCY TRIGGERED FROM ${data.deviceId} 🔴`);
            console.log(`Location: ${JSON.stringify(data.coordinates)}`);
            
            // In a real app we'd look up nearby users via $near query
            // and emit to their specific rooms. For MVP, we broadcast to everyone 'danger_nearby' except sender
            socket.broadcast.emit('danger_nearby', {
                sourceDevice: data.deviceId,
                eventId: data.eventId,
                coordinates: data.coordinates,
                timestamp: Date.now()
            });
            
            // Return acknowledgment
            socket.emit('emergency_acknowledged', { success: true });
        });

        socket.on('cancel_emergency', (data) => {
            console.log(`🟢 EMERGENCY CANCELLED: ${data.deviceId}`);
            socket.broadcast.emit('safety_restored', {
                sourceDevice: data.deviceId
            });
        });

        socket.on('disconnect', () => {
            console.log(`💤 Client Disconnected: ${socket.id}`);
        });
    });
};
