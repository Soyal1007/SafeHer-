const express = require('express');
const router = express.Router();

// ============================
// Twilio SMS / Call Integration
// ============================
let twilioClient = null;
let twilioReady = false;

try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        twilioReady = true;
        console.log('✅ Twilio SMS Ready');
    } else {
        console.warn('⚠️  Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing). SMS will be logged only.');
    }
} catch(e) {
    console.warn('⚠️  Twilio init failed:', e.message);
}

// POST /api/emergency/notify
// Body: { contacts: [{name, phone}], message, deviceId, location: {lat, lon} }
router.post('/notify', async (req, res) => {
    const { contacts = [], message, deviceId, location } = req.body;

    if (!contacts.length) {
        return res.status(400).json({ success: false, error: 'No contacts provided' });
    }

    const locationText = (location && location.lat && location.lon)
        ? `📍 Location: https://maps.google.com/?q=${location.lat},${location.lon}`
        : '📍 Location: Unknown';

    const smsBody = message || `🚨 EMERGENCY ALERT from SafeHer!\nSomeone needs help urgently.\n${locationText}\nThis is an automated SOS message.`;

    const results = [];

    for (const contact of contacts) {
        const phone = contact.phone ? String(contact.phone).replace(/\s+/g, '') : null;
        if (!phone) continue;

        // Normalize Indian numbers to E.164 format
        let e164 = phone;
        if (phone.startsWith('0')) {
            e164 = '+91' + phone.slice(1);
        } else if (!phone.startsWith('+')) {
            e164 = '+91' + phone;
        }

        console.log(`[SafeHer] Sending SOS SMS to ${contact.name} (${e164})`);

        if (twilioReady && twilioClient) {
            try {
                const msg = await twilioClient.messages.create({
                    body: smsBody,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: e164
                });
                results.push({ name: contact.name, phone: e164, status: 'sent', sid: msg.sid });
                console.log(`✅ SMS sent to ${contact.name} | SID: ${msg.sid}`);
            } catch(smsErr) {
                results.push({ name: contact.name, phone: e164, status: 'failed', error: smsErr.message });
                console.error(`❌ SMS failed for ${contact.name}:`, smsErr.message);
            }
        } else {
            // Demo mode: log and return success
            results.push({ name: contact.name, phone: e164, status: 'demo_logged' });
            console.log(`[DEMO] Would send SMS to ${contact.name} @ ${e164}: "${smsBody.slice(0, 60)}..."`);
        }
    }

    res.json({ success: true, results, twilioConfigured: twilioReady });
});

// POST /api/emergency/call
// Initiates a Twilio call to the first emergency contact
router.post('/call', async (req, res) => {
    const { contacts = [], deviceId, location } = req.body;
    const primary = contacts[0];

    if (!primary) {
        return res.status(400).json({ success: false, error: 'No contact to call' });
    }

    let e164 = String(primary.phone).replace(/\s+/g, '');
    if (e164.startsWith('0')) e164 = '+91' + e164.slice(1);
    else if (!e164.startsWith('+')) e164 = '+91' + e164;

    console.log(`[SafeHer] Initiating call to ${primary.name} (${e164})`);

    if (twilioReady && twilioClient) {
        try {
            const call = await twilioClient.calls.create({
                twiml: `<Response><Say voice="woman" language="en-IN">This is an emergency SOS alert from SafeHer. Someone needs your help urgently. Please call them back immediately.</Say><Pause length="2"/><Say voice="woman">This is an automated emergency alert. Please respond immediately.</Say></Response>`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: e164
            });
            res.json({ success: true, callSid: call.sid });
            console.log(`✅ Call initiated to ${primary.name} | SID: ${call.sid}`);
        } catch(callErr) {
            res.status(500).json({ success: false, error: callErr.message });
            console.error('❌ Call failed:', callErr.message);
        }
    } else {
        res.json({ success: true, demo: true, message: `[DEMO] Would call ${primary.name} at ${e164}` });
        console.log(`[DEMO] Would call ${primary.name} @ ${e164}`);
    }
});

module.exports = router;
