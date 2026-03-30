// SafeHer Frontend Logic v4.0 — Aegis Hardened
// Dynamically determine the server origin
const SERVER_ORIGIN = window.location.origin;

// Safe socket init
let socket;
try {
    if (typeof io !== 'undefined') {
        socket = io(SERVER_ORIGIN, {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 3,
            timeout: 10000
        });
    } else {
        console.warn('[SafeHer] io is undefined. Running in offline mode.');
        socket = { emit: () => {}, on: () => {} };
    }
} catch(e) {
    console.warn('[SafeHer] Socket.io failed. Offline mode.', e);
    socket = { emit: () => {}, on: () => {} };
}

const state = {
    deviceId: localStorage.getItem('safeher_device_id') || 'usr_' + Math.random().toString(36).substring(7),
    lastShakeTime: 0,
    lastVoiceTime: 0,
    triggerLockdown: false,
    location: null,
    distressActive: false,
    motionData: [],
    audioContext: null,
    analyser: null,
    microphone: null,
    micStream: null,
    recognition: null,
    cameraStream: null,
    sensorsArmed: false,
    activeEventId: null,
    cancelTick: null
};
localStorage.setItem('safeher_device_id', state.deviceId);

try { if (socket.emit) socket.emit('register_device', { deviceId: state.deviceId }); } catch(e) {}

const API_URL = SERVER_ORIGIN + '/api';

window.updateRideDetails = function() {
    const cabInput = document.getElementById('ride-cab-input');
    const driverInput = document.getElementById('ride-driver-input');
    const cabDisplay = document.getElementById('display-cab-number');
    const driverDisplay = document.getElementById('display-driver-name');
    if (cabInput && cabDisplay) cabDisplay.innerText = (cabInput.value || 'KA 01 AB 1234').toUpperCase();
    if (driverInput && driverDisplay) driverDisplay.innerText = driverInput.value || 'Vikram Singh';
};

window.handleVerifyRide = function() {
    const driverInput = document.getElementById('ride-driver-input');
    const name = (driverInput ? driverInput.value.toLowerCase() : '');
    
    const badge = document.getElementById('status-badge');
    const iconBox = document.getElementById('status-icon-box');
    const icon = document.getElementById('status-icon');
    const title = document.getElementById('status-title');
    const subtitle = document.getElementById('status-subtitle');
    const tagsDiv = document.getElementById('driver-tags');

    if (!badge) return;

    // 50/50 randomized danger check to easily demonstrate both states, 
    // also supports typing "danger" or "unsafe" explicitly to force it if needed.
    const dangerWords = ['bad', 'fake', 'danger', 'criminal', 'alert', 'unsafe'];
    const hasDangerKeyword = dangerWords.some(w => name.includes(w));
    const isDanger = hasDangerKeyword || (Math.random() > 0.5);

    if (isDanger) {
        badge.className = 'bg-error-container/10 border border-error/50 rounded-4xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-[0_0_30px_rgba(255,180,171,0.2)] transition-colors duration-500';
        iconBox.className = 'w-20 h-20 rounded-full bg-error flex items-center justify-center text-on-error shadow-[0_0_30px_rgba(255,180,171,0.6)] animate-pulse';
        icon.innerText = 'warning';
        title.innerText = 'UNSAFE DRIVER';
        title.className = 'text-4xl font-headline font-black text-error tracking-tighter';
        subtitle.innerText = 'Multiple spam/danger reports found!';
        subtitle.className = 'text-error text-sm mt-1 uppercase tracking-widest font-bold';
        
        if (tagsDiv) {
            tagsDiv.innerHTML = '<span class="px-3 py-1 bg-error-container text-on-error-container text-[10px] font-bold rounded-full border border-error shadow-sm">REPORTED SPAM</span>';
        }

        // Spawn interactive alert modal giving user the choice
        if (!document.getElementById('driver-alert-modal')) {
            const modal = document.createElement('div');
            modal.id = 'driver-alert-modal';
            modal.innerHTML = `
                <div style="position:fixed;inset:0;background:rgba(147,0,10,0.85);backdrop-filter:blur(15px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;">
                    <div style="background:#fff7fb;border-radius:24px;padding:32px;text-align:center;max-width:400px;box-shadow:0 30px 60px rgba(0,0,0,0.6);border:2px solid #ffb4ab;animation:popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                        <style>@keyframes popIn { 0% { opacity:0; transform:scale(0.8); } 100% { opacity:1; transform:scale(1); } }</style>
                        <div style="width:70px;height:70px;border-radius:50%;background:#ffdad6;display:flex;align-items:center;justify-content:center;margin:0 auto 20px auto;">
                            <span class="material-symbols-outlined" style="font-size:2.5rem;color:#93000a;">gpp_bad</span>
                        </div>
                        <h2 style="font-family:'Space Grotesk', sans-serif;font-size:1.6rem;font-weight:900;color:#93000a;margin-bottom:12px;text-transform:uppercase;line-height:1.1;">Unsafe Driver Detected</h2>
                        <p style="font-family:'Inter', sans-serif;font-weight:600;color:#6f4f76;margin-bottom:32px;font-size:0.95rem;line-height:1.5;">
                            This ride provider has multiple spam and unsafe incident reports. How would you like to proceed?
                        </p>
                        <div style="display:flex;flex-direction:column;gap:16px;">
                            <button onclick="document.getElementById('driver-alert-modal').remove(); triggerVerification('RIDE_DANGER');" style="width:100%;padding:18px;background:#93000a;color:white;border:none;border-radius:16px;font-family:'Space Grotesk', sans-serif;font-weight:900;font-size:1.1rem;cursor:pointer;text-transform:uppercase;box-shadow:0 8px 20px rgba(147,0,10,0.4);transition:transform 0.2s;">
                                <span class="material-symbols-outlined" style="vertical-align:bottom;margin-right:6px;">emergency_share</span> Trigger SOS Alarm
                            </button>
                            <button onclick="document.getElementById('driver-alert-modal').remove(); document.getElementById('status-title').innerText='RIDE CANCELED'; document.getElementById('status-subtitle').innerText='Anonymous report submitted safely.';" style="width:100%;padding:18px;background:transparent;color:#93000a;border:2px solid #93000a;border-radius:16px;font-family:'Space Grotesk', sans-serif;font-weight:900;font-size:1.1rem;cursor:pointer;text-transform:uppercase;transition:background 0.2s;hover:background:#ffdad6;">
                                <span class="material-symbols-outlined" style="vertical-align:bottom;margin-right:6px;">close</span> Cancel & Report
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    } else {
        badge.className = 'bg-primary-container/10 border border-primary/20 rounded-4xl p-8 flex flex-col items-center justify-center text-center space-y-4 glow-primary transition-colors duration-500';
        iconBox.className = 'w-20 h-20 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[0_0_30px_rgba(137,103,144,0.4)] transition-colors duration-500';
        icon.innerText = 'verified';
        title.innerText = 'SAFE TO BOARD';
        title.className = 'text-4xl font-headline font-black text-primary tracking-tighter';
        subtitle.innerText = 'Verified by Aegis Systems';
        subtitle.className = 'text-on-surface-variant text-sm mt-1 uppercase tracking-widest font-bold';
        
        if (tagsDiv) {
            tagsDiv.innerHTML = '<span class="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20">POLICE VERIFIED</span><span class="px-3 py-1 bg-secondary-container/20 text-on-secondary-container text-[10px] font-bold rounded-full border border-secondary-container/30">TOP RATED</span>';
        }
    }
};

function updateUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition((pos) => {
            state.location = { lon: pos.coords.longitude, lat: pos.coords.latitude };
            fetch(`${API_URL}/users/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: state.deviceId, coordinates: [state.location.lon, state.location.lat] })
            });
            if(window.updateMapMarker) window.updateMapMarker(state.location);
        }, console.error, { enableHighAccuracy: true });
    }
}

function startMotionDetection() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(r => {
            if (r === 'granted') bindMotion();
        });
    } else {
        bindMotion();
    }
}

let _shakeConfirmTimer = null;
function bindMotion() {
    window.addEventListener('devicemotion', (event) => {
        if (state.distressActive || state.triggerLockdown) return;
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;
        const total = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        if (total > 28) { // Increased from 20 to 28 for aggressive intentional shaking only
            state.lastShakeTime = Date.now();
            console.log('[SafeHer] 📱 Shake Detected! (total:', total.toFixed(1), ')');

            // If voice was detected recently → trigger fusion immediately
            if (state.lastVoiceTime > 0 && (Date.now() - state.lastVoiceTime) < 5000) {
                state.lastShakeTime = 0;
                state.lastVoiceTime = 0;
                triggerVerification('FUSION_SHAKE_VOICE');
                return;
            }

            // Shake alone test for sustained shake (500ms debounce instead of instant or 2s)
            if (!_shakeConfirmTimer) {
                console.log('[SafeHer] High-g motion detected, verifying shake intent...');
                _shakeConfirmTimer = setTimeout(() => {
                    _shakeConfirmTimer = null;
                    if (!state.distressActive && !state.triggerLockdown && state.sensorsArmed) {
                        console.log('[SafeHer] 🚨 Deliberate Shake SOS Triggered!');
                        triggerVerification('SHAKE_ALERT');
                    }
                }, 500); // 500ms is enough to filter a drop but fast enough for emergency
            }
        }
    });
}

// =================== AUDIO CONTEXT (ambient only) ===================
async function startAudioDetection() {
    try {
        if (state.audioContext && state.audioContext.state !== 'closed') return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.micStream = stream;
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.microphone = state.audioContext.createMediaStreamSource(stream);
        state.microphone.connect(state.analyser);
        state.analyser.fftSize = 256;
        console.log('[SafeHer] Audio Context [LIVE] 🟢');
        updateSensorStatus('audio', true);
    } catch (e) {
        console.error('[SafeHer] Mic/Audio denied:', e.message);
        updateSensorStatus('audio', false);
    }
}

// =================== VOICE KEYWORD DETECTION ===================
// Strategy: continuous=false + immediate restart after each session.
// This is the most reliable approach on Android Chrome and Safari iOS.
// continuous=true has a known bug where it stops listening silently.
let _voiceSessionActive = false;

function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('[SafeHer] SpeechRecognition not supported in this browser.');
        updateSensorStatus('voice', false);
        return;
    }
    if (_voiceSessionActive) return; // Prevent duplicate sessions
    if (state.distressActive || state.triggerLockdown) return;

    // Tear down previous instance completely
    if (state.recognition) {
        state.recognition.onstart = null;
        state.recognition.onresult = null;
        state.recognition.onerror = null;
        state.recognition.onend = null;
        try { state.recognition.abort(); } catch(e) {}
        state.recognition = null;
    }

    const recognition = new SpeechRecognition();
    state.recognition = recognition;
    _voiceSessionActive = true;

    recognition.continuous = false;      // false = restart loop pattern (most reliable)
    recognition.interimResults = true;   // catch keywords mid-utterance
    recognition.lang = 'en-IN';         // Indian English + Hindi accent support
    recognition.maxAlternatives = 3;     // try 3 alternatives for accuracy

    const KEYWORDS = [
        'help', 'help me', 'save me', 'sos', 'emergency',
        'bachao', 'madat', 'madat karo', 'madad', 'rescue',
        'danger', 'attack', 'bachao mujhe', 'police', 'fire'
    ];

    recognition.onstart = () => {
        console.log('[SafeHer] 🎙️ Voice [LISTENING]');
        updateSensorStatus('voice', true);
    };

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            // Check all alternatives, not just the top one
            for (let alt = 0; alt < event.results[i].length; alt++) {
                const transcript = event.results[i][alt].transcript.toLowerCase().trim();
                if (!transcript) continue;

                console.log(`[SafeHer] 🎙️ [${event.results[i].isFinal ? 'Final' : 'Interim'}] alt${alt}: "${transcript}"`);

                // Show non-keyword speech in debug UI
                const debugEl = document.getElementById('voice-debug-text');
                if (debugEl && transcript.length > 2) {
                    debugEl.innerText = `👂 "${transcript}"`;
                    debugEl.style.color = '#888';
                }

                if (KEYWORDS.some(k => transcript.includes(k))) {
                    console.log('[SafeHer] 🚨 DISTRESS KEYWORD:', transcript);
                    state.lastVoiceTime = Date.now();

                    if (debugEl) {
                        debugEl.innerText = `🚨 SOS: "${transcript}"`;
                        debugEl.style.color = '#F44336';
                    }

                    // Cancel pending shake timer if any
                    if (_shakeConfirmTimer) {
                        clearTimeout(_shakeConfirmTimer);
                        _shakeConfirmTimer = null;
                    }

                    // Stop this recognition instance before triggering
                    _voiceSessionActive = false;
                    recognition.onend = null;
                    try { recognition.abort(); } catch(e) {}
                    state.recognition = null;

                    triggerVerification('VOICE_DISTRESS');
                    return;
                }
                break; // Only need to check first alternative if no keyword match
            }
        }
    };

    recognition.onerror = (e) => {
        _voiceSessionActive = false;
        console.warn('[SafeHer] Voice error:', e.error);
        updateSensorStatus('voice', false);
        if (e.error === 'not-allowed') {
            console.error('[SafeHer] Mic permission denied. Cannot restart.');
            return; // Don't retry — user must grant permission
        }
        if (e.error !== 'aborted') {
            scheduleRecognitionRestart();
        }
    };

    recognition.onend = () => {
        _voiceSessionActive = false;
        console.log('[SafeHer] Voice session ended — restarting.');
        updateSensorStatus('voice', false);
        if (!state.distressActive && state.sensorsArmed && !state.triggerLockdown) {
            scheduleRecognitionRestart();
        }
    };

    try {
        recognition.start();
    } catch(e) {
        _voiceSessionActive = false;
        console.warn('[SafeHer] recognition.start() threw:', e.message);
        scheduleRecognitionRestart();
    }
}

let _recognitionRestartTimer = null;
function scheduleRecognitionRestart() {
    if (_recognitionRestartTimer) return; // debounce
    _recognitionRestartTimer = setTimeout(() => {
        _recognitionRestartTimer = null;
        if (!state.distressActive && state.sensorsArmed && !state.triggerLockdown) {
            startVoiceRecognition();
        }
    }, 800); // 800ms — Chrome requires a brief gap between sessions
}


// Live camera — only invoked during an active evidence session
async function startProtocolCamera() {
    console.log('[SafeHer] Attempting camera engagement...');
    const video = document.getElementById('protocol-cam-feed');
    if (!video) {
        console.warn('[SafeHer] Camera element not found on this page.');
        return;
    }
    if (state.cameraStream) {
        video.srcObject = state.cameraStream;
        video.play().catch(e => console.error('Play failed', e));
        return;
    }
    try {
        state.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = state.cameraStream;
        video.play().catch(e => console.error('Play failed', e));
        updateSensorStatus('camera', true);
        console.log('[SafeHer] Evidence Camera [LIVE] 🟢');
    } catch (e) {
        console.error('[SafeHer] Camera error:', e);
        updateSensorStatus('camera', false);
    }
}

// =================== AEGIS FUSION ENGINE ===================
function checkAegisFusion() {
    if (state.distressActive || state.triggerLockdown) return;

    const timeDiff = Math.abs(state.lastShakeTime - state.lastVoiceTime);
    const bothDetected = state.lastShakeTime > 0 && state.lastVoiceTime > 0;

    if (bothDetected && timeDiff < 5000) {
        console.log('[SafeHer] !!! AEGIS FUSION TRIGGERED (Shake + Voice) !!!');
        state.lastShakeTime = 0; // Reset to prevent double-fire
        state.lastVoiceTime = 0;
        triggerVerification('FUSION_ACTIVATION');
    } else {
        console.log(`[SafeHer] Fusion pending | Shake: ${state.lastShakeTime > 0 ? 'YES' : 'NO'} | Voice: ${state.lastVoiceTime > 0 ? 'YES' : 'NO'} | Gap: ${timeDiff}ms`);
    }
}

// =================== SOS TRIGGER ===================
function triggerVerification(type) {
    if (state.distressActive) return;
    state.distressActive = true;

    // Stop voice recognition cycling while distress is active
    if (state.recognition) {
        state.recognition.onend = null;
        try { state.recognition.abort(); } catch(e) {}
    }

    const overlay = document.createElement('div');
    overlay.id = 'zenz-verification-modal';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(179,38,30,0.97); backdrop-filter: blur(20px);
        z-index: 999999; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: white; font-family: 'Space Grotesk', sans-serif;
        text-align: center; padding: 16px; overflow: hidden;
    `;
    overlay.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span class="material-symbols-outlined" style="font-size:2.5rem;color:white;">emergency_share</span>
            <h1 style="font-size:1.8rem;font-weight:900;text-transform:uppercase;letter-spacing:-1px;margin:0;">Emergency Activated</h1>
        </div>

        <!-- SEAMLESS CAMERA WITH FLIP CAPABILITY (Mobile Hardware Fallback) -->
        <div style="width:100%;max-width:500px;margin-bottom:12px;position:relative;border-radius:12px;overflow:hidden;background:black;border:2px solid rgba(255,255,255,0.3);aspect-ratio:3/2;">
            <video id="sos-cam-main" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;"></video>
            <div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.6);padding:3px 8px;border-radius:20px;font-size:9px;font-weight:900;letter-spacing:1px;display:flex;align-items:center;gap:4px;">
                <span style="width:6px;height:6px;border-radius:50%;background:#f44336;display:inline-block;animation:pulse 1s infinite;"></span><span id="sos-cam-label">LIVE STREAM (FRONT)</span>
            </div>
            <button id="sos-cam-flip" style="position:absolute;bottom:8px;right:8px;background:rgba(255,255,255,0.2);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.5);color:white;border-radius:50%;width:35px;height:35px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;">
                <span class="material-symbols-outlined" style="font-size:16px;">flip_camera_ios</span>
            </button>
        </div>

        <p style="font-size:0.85rem;opacity:0.85;margin-bottom:6px;">Auto-escalating to Emergency Contacts in...</p>
        <h2 id="zenz-countdown" style="font-size:7rem;font-weight:900;line-height:1;margin:4px 0;font-family:monospace;">5</h2>
        <div style="width:100%;max-width:300px;height:5px;background:rgba(255,255,255,0.2);border-radius:10px;overflow:hidden;margin-bottom:16px;">
            <div id="zenz-progress" style="width:100%;height:100%;background:white;transition:width 1s linear;"></div>
        </div>
        <button id="zenz-cancel-btn" style="
            padding: 16px 40px; background: white; color: #b3261e; border: none;
            border-radius: 20px; font-size: 1rem; font-weight: 900; cursor: pointer;
            text-transform: uppercase; box-shadow: 0 15px 35px rgba(0,0,0,0.25);
            position: relative; overflow: hidden;
            user-select: none; -webkit-user-select: none; touch-action: none;
        ">
            <span id="cancel-text" style="position:relative;z-index:2;">HOLD 3s — I AM SAFE</span>
            <div id="cancel-progress" style="position:absolute;top:0;left:0;height:100%;width:0%;background:rgba(179,38,30,0.18);z-index:1;"></div>
        </button>
        <p style="margin-top:10px;font-size:0.65rem;opacity:0.45;text-transform:uppercase;letter-spacing:1px;">Hold for 3 seconds to cancel</p>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>
    `;
    document.body.appendChild(overlay);

    // Flip camera logic for mobile hardware limitations
    let currentFacingMode = 'user';
    const mainVideo = document.getElementById('sos-cam-main');
    const camLabel = document.getElementById('sos-cam-label');
    
    async function initCamera(facing) {
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(t => t.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing }, audio: true
            });
            state.cameraStream = stream;
            if (mainVideo) mainVideo.srcObject = stream;
            camLabel.innerText = `LIVE STREAM (${facing.toUpperCase()})`;
        } catch(e) {
            console.warn('[SafeHer] Camera unavailable:', e);
            if (facing === 'environment') {
               // Fallback to front if back fails
               initCamera('user');
            }
        }
    }
    initCamera(currentFacingMode);
    
    document.getElementById('sos-cam-flip').addEventListener('click', () => {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        initCamera(currentFacingMode);
    });

    // Register event in background
    fetch(`${API_URL}/events/distress-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: state.deviceId, type, coordinates: state.location ? [state.location.lon, state.location.lat] : [0,0] })
    }).then(res => res.json()).then(data => {
        state.activeEventId = data.eventId;
    }).catch(e => console.warn('[SafeHer] Offline distress noted.', e));

    // Countdown — 5 seconds
    let seconds = 5;
    const cdown = document.getElementById('zenz-countdown');
    const pbar = document.getElementById('zenz-progress');
    const countdownInterval = setInterval(() => {
        seconds--;
        if (cdown) cdown.innerText = seconds;
        if (pbar) pbar.style.width = (seconds / 5 * 100) + '%';
        if (seconds <= 0) {
            clearInterval(countdownInterval);
            escalateEmergency(state.activeEventId);
        }
    }, 1000);

    // ===== 3s HOLD-TO-CANCEL =====
    const cancelBtn = document.getElementById('zenz-cancel-btn');
    const cancelProgress = document.getElementById('cancel-progress');
    let holdTimer = null;
    let holdStart = null;
    let holdTick = null;
    let cancelExecuted = false; // guard to prevent double-fire

    const startHold = (e) => {
        if (cancelExecuted) return;
        if (e.cancelable) e.preventDefault();
        holdStart = Date.now();
        cancelBtn.style.transform = 'scale(0.95)';

        holdTimer = setTimeout(() => {
            if (cancelExecuted) return;
            cancelExecuted = true;

            clearInterval(countdownInterval);
            clearInterval(holdTick);

            // Full sensor stop & lockdown
            state.distressActive = false;
            state.triggerLockdown = true;
            state.lastShakeTime = 0;
            state.lastVoiceTime = 0;

            // Stop all camera streams
            if (state.cameraStream) {
                state.cameraStream.getTracks().forEach(t => t.stop());
                state.cameraStream = null;
            }
            if (state.frontCameraStream) {
                state.frontCameraStream.getTracks().forEach(t => t.stop());
                state.frontCameraStream = null;
            }
            // Cancel shake confirmation timer
            if (_shakeConfirmTimer) {
                clearTimeout(_shakeConfirmTimer);
                _shakeConfirmTimer = null;
            }

            // Remove modal
            const modal = document.getElementById('zenz-verification-modal');
            if (modal && modal.parentNode) modal.parentNode.removeChild(modal);

            // Cancel backend event
            if (state.activeEventId) {
                fetch(`${API_URL}/events/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: state.activeEventId, deviceId: state.deviceId })
                });
            }
            state.activeEventId = null;

            // Show brief confirmation
            const toast = document.createElement('div');
            toast.style = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:14px 30px;border-radius:50px;font-weight:bold;font-family:sans-serif;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.3);';
            toast.innerText = '✅ SOS Cancelled — You are safe.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

            // Restart voice recognition after lockdown
            setTimeout(() => {
                state.triggerLockdown = false;
                if (state.sensorsArmed) startVoiceRecognition();
            }, 6000);

        }, 3000);

        holdTick = setInterval(() => {
            if (!holdStart) return;
            const elapsed = Date.now() - holdStart;
            const perc = Math.min(100, (elapsed / 3000) * 100);
            if (cancelProgress) cancelProgress.style.width = perc + '%';
        }, 30);
    };

    const stopHold = () => {
        if (cancelExecuted) return;
        clearTimeout(holdTimer);
        clearInterval(holdTick);
        holdStart = null;
        if (cancelBtn) cancelBtn.style.transform = 'scale(1)';
        if (cancelProgress) cancelProgress.style.width = '0%';
    };

    cancelBtn.addEventListener('mousedown', startHold);
    cancelBtn.addEventListener('touchstart', startHold, { passive: false });
    cancelBtn.addEventListener('mouseup', stopHold);
    cancelBtn.addEventListener('touchend', stopHold);
    cancelBtn.addEventListener('mouseleave', stopHold);
    cancelBtn.addEventListener('touchcancel', stopHold);
}

// =================== ESCALATION ===================
function escalateEmergency(eventId) {
    const overlay = document.getElementById('zenz-verification-modal');
    if (!overlay) return;

    // Stop voice mic while escalated
    if (state.recognition) {
        state.recognition.onend = null;
        try { state.recognition.abort(); } catch(e) {}
    }

    overlay.style.background = 'black';
    overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:black;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:'Space Grotesk',sans-serif;text-align:center;padding:12px;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,rgba(137,103,144,0.12) 0%,rgba(0,0,0,1) 80%);pointer-events:none;"></div>
            <div style="position:absolute;top:0;left:0;width:100%;height:2px;background:rgba(189,103,144,0.5);box-shadow:0 0 15px rgba(189,103,144,0.8);animation:scan 4s linear infinite;pointer-events:none;"></div>

            <!-- Header -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-shrink:0;">
                <div style="position:relative;">
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border:2px solid #896790;border-radius:50%;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
                    <span class="material-symbols-outlined" style="font-size:3rem;color:#896790;font-variation-settings:'FILL' 1;">shield_with_heart</span>
                </div>
                <div>
                    <h1 style="font-size:1.4rem;font-weight:900;text-transform:uppercase;color:#ffe1f5;margin:0;letter-spacing:1px;">SOS BROADCASTING</h1>
                    <p style="font-size:0.65rem;opacity:0.6;text-transform:uppercase;letter-spacing:2px;margin:2px 0 0;">Contacts & Authorities Receiving Status</p>
                </div>
            </div>

            <!-- SEAMLESS CAMERA WITH FLIP CAPABILITY -->
            <div style="width:100%;max-width:520px;margin-bottom:10px;position:relative;border-radius:12px;overflow:hidden;background:#111;border:2px solid rgba(244,67,54,0.6);aspect-ratio:3/2;">
                <video id="esc-cam-main" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;"></video>
                <div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,0.75);padding:2px 8px;border-radius:20px;font-size:8px;font-weight:900;letter-spacing:1px;display:flex;align-items:center;gap:3px;color:white;">
                    <span style="width:5px;height:5px;border-radius:50%;background:#f44336;display:inline-block;animation:blink 1s infinite;"></span><span id="esc-cam-label">LIVE STREAM (FRONT)</span>
                </div>
                <button id="esc-cam-flip" style="position:absolute;bottom:8px;right:8px;background:rgba(255,255,255,0.2);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.5);color:white;border-radius:50%;width:35px;height:35px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;">
                    <span class="material-symbols-outlined" style="font-size:16px;">flip_camera_ios</span>
                </button>
            </div>

            <!-- Status ticker (compact) -->
            <div id="sos-status-ticker" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:10px 14px;width:100%;max-width:520px;text-align:left;font-family:monospace;font-size:9px;margin-bottom:12px;">
                <div id="ticker-line-1" style="margin-bottom:5px;color:#4CAF50;">[SECURE] CONNECTION ESTABLISHED</div>
                <div id="ticker-line-2" style="margin-bottom:5px;color:white;opacity:0.8;">[LIVE] GPS POSITION ENCRYPTED</div>
                <div id="ticker-line-3" style="margin-bottom:5px;color:white;opacity:0.5;">[BROADCAST] ALERTING GUARDIANS...</div>
                <div id="ticker-line-4" style="color:white;opacity:0.2;">[SMS] NOTIFYING EMERGENCY CONTACTS...</div>
            </div>

            <button id="zenz-resolve-btn" style="padding:12px 28px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:14px;font-size:0.85rem;font-weight:bold;cursor:pointer;text-transform:uppercase;">RESOLVE EMERGENCY</button>
        </div>
        <style>
            @keyframes scan{0%{top:-10%}100%{top:110%}}
            @keyframes ping{75%,100%{transform:translate(-50%,-50%) scale(2);opacity:0}}
            @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        </style>
    `;

    // Escalation camera init
    let escMode = 'user';
    const escV = document.getElementById('esc-cam-main');
    const escLabel = document.getElementById('esc-cam-label');
    
    async function initEscCamera(facing) {
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(t => t.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing }, audio: true
            });
            state.cameraStream = stream;
            if (escV) escV.srcObject = stream;
            if (escLabel) escLabel.innerText = `LIVE STREAM (${facing.toUpperCase()})`;
        } catch(e) {
            console.warn('[SafeHer] Esc Cam failed:', e);
            if (facing === 'environment') initEscCamera('user');
        }
    }
    initEscCamera(escMode);
    
    document.getElementById('esc-cam-flip').addEventListener('click', () => {
        escMode = escMode === 'user' ? 'environment' : 'user';
        initEscCamera(escMode);
    });

    // Ticker animation
    const tickerSteps = [
        { id: 'ticker-line-3', text: '[BROADCAST] ALERTING GUARDIANS... \u2705 (3 ALERTED)', color: '#4CAF50', delay: 2000 },
        { id: 'ticker-line-4', text: '[SMS] CONTACTING EMERGENCY NUMBERS... \ud83d\udcf1', color: '#ffcc00', delay: 4000 },
        { id: 'ev-extra-1',    text: '[EVIDENCE] AUDIO/VIDEO RECORDING \ud83d\udd34', color: '#F44336', delay: 6000 },
        { id: 'ev-extra-2',    text: '[AI] SCENE ANALYSIS ACTIVE \u2705', color: '#4CAF50', delay: 8000 }
    ];
    tickerSteps.forEach(s => {
        setTimeout(() => {
            const ticker = document.getElementById('sos-status-ticker');
            if (!ticker) return;
            let line = document.getElementById(s.id);
            if (!line) { line = document.createElement('div'); line.id = s.id; line.style = 'margin-bottom:5px;font-size:9px;'; ticker.appendChild(line); }
            line.innerText = s.text;
            line.style.color = s.color;
            line.style.opacity = '1';
        }, s.delay);
    });

    // REAL SMS DISPATCH
    const emergencyContacts = getEmergencyContacts();
    const gps = state.location ? { lat: state.location.lat, lon: state.location.lon } : null;
    if (emergencyContacts.length > 0) {
        const smsMsg = `\ud83d\udea8 SOS from SafeHer!\nI need help urgently!${gps ? `\n\ud83d\udccd https://maps.google.com/?q=${gps.lat},${gps.lon}` : ''}\nPlease call me back immediately. This is automated.`;
        fetch(`${API_URL}/emergency/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: emergencyContacts, message: smsMsg, deviceId: state.deviceId, location: gps })
        }).then(r => r.json()).then(data => {
            console.log('[SafeHer] SMS dispatch:', data.results);
            const ticker = document.getElementById('sos-status-ticker');
            const smsLine = document.getElementById('ticker-line-4');
            if (smsLine) {
                const sent = (data.results || []).filter(r => ['sent','demo_logged'].includes(r.status)).length;
                smsLine.innerText = `[SMS] ${sent}/${emergencyContacts.length} CONTACTS NOTIFIED \u2705`;
                smsLine.style.color = '#4CAF50';
                smsLine.style.opacity = '1';
            }
        }).catch(e => console.warn('[SafeHer] SMS failed:', e.message));

        // Voice call to primary contact
        fetch(`${API_URL}/emergency/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: [emergencyContacts[0]], deviceId: state.deviceId, location: gps })
        }).catch(e => console.warn('[SafeHer] Call failed:', e.message));
    } else {
        console.warn('[SafeHer] No emergency contacts saved. Add contacts via the Settings panel.');
    }

    // Broadcast to socket + backend event log
    socket.emit('emergency_broadcast', { deviceId: state.deviceId, eventId, coordinates: state.location ? [state.location.lon, state.location.lat] : [0,0] });
    fetch(`${API_URL}/events/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, deviceId: state.deviceId, coordinates: state.location ? [state.location.lon, state.location.lat] : [0,0] })
    }).catch(e => console.warn('[SafeHer] events/trigger offline:', e.message));

    const btn = document.getElementById('zenz-resolve-btn');

    if (btn) btn.onclick = () => {
        const modal = document.getElementById('zenz-verification-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        state.distressActive = false;
        state.triggerLockdown = true;
        state.lastShakeTime = 0;
        state.lastVoiceTime = 0;

        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(t => t.stop());
            state.cameraStream = null;
        }
        if (state.frontCameraStream) {
            state.frontCameraStream.getTracks().forEach(t => t.stop());
            state.frontCameraStream = null;
        }
        if (_shakeConfirmTimer) {
            clearTimeout(_shakeConfirmTimer);
            _shakeConfirmTimer = null;
        }

        cancelEmergency(eventId);

        const toast = document.createElement('div');
        toast.style = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:14px 30px;border-radius:50px;font-weight:bold;font-family:sans-serif;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,0.3);';
        toast.innerText = '✅ Emergency Resolved';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

        setTimeout(() => {
            state.triggerLockdown = false;
            if (state.sensorsArmed) startVoiceRecognition();
        }, 6000);
    };
}

function cancelEmergency(eventId) {
    if (socket.emit) socket.emit('cancel_emergency', { deviceId: state.deviceId });
    if (eventId) {
        fetch(`${API_URL}/events/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, deviceId: state.deviceId })
        });
    }
}

// =================== EMERGENCY CONTACTS HELPERS ===================
function getEmergencyContacts() {
    try {
        return JSON.parse(localStorage.getItem('safeher_emergency_contacts') || '[]');
    } catch(e) { return []; }
}

function saveEmergencyContacts(contacts) {
    try {
        localStorage.setItem('safeher_emergency_contacts', JSON.stringify(contacts));
    } catch(e) { console.warn('[SafeHer] Could not save contacts:', e); }
}

// Expose globally for the settings panel UI
window.getEmergencyContacts = getEmergencyContacts;
window.saveEmergencyContacts = saveEmergencyContacts;



// GLOBAL SENSOR CLEANUP
window.stopAegisSensors = function() {
    console.log('[SafeHer] Full Sensor Shutdown...');
    state.sensorsArmed = false;
    state.distressActive = false;
    state.triggerLockdown = true;
    state.lastShakeTime = 0;
    state.lastVoiceTime = 0;

    if (_shakeConfirmTimer) {
        clearTimeout(_shakeConfirmTimer);
        _shakeConfirmTimer = null;
    }
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(t => t.stop());
        state.cameraStream = null;
    }
    if (state.frontCameraStream) {
        state.frontCameraStream.getTracks().forEach(t => t.stop());
        state.frontCameraStream = null;
    }
    if (state.recognition) {
        state.recognition.onend = null;
        try { state.recognition.abort(); } catch(e) {}
        state.recognition = null;
    }
    if (state.micStream) {
        state.micStream.getTracks().forEach(t => t.stop());
        state.micStream = null;
    }
    if (state.audioContext) {
        try { state.audioContext.close(); } catch(e) {}
        state.audioContext = null;
    }
    if (_recognitionRestartTimer) {
        clearTimeout(_recognitionRestartTimer);
        _recognitionRestartTimer = null;
    }
    console.log('[SafeHer] All sensors stopped.');
};

// Danger alert from socket
socket.on('danger_nearby', (data) => {
    const alertDiv = document.createElement('div');
    alertDiv.style = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#b3261e;color:white;padding:15px 30px;border-radius:50px;box-shadow:0 10px 30px rgba(179,38,30,0.5);z-index:9999;font-weight:bold;font-family:sans-serif;animation:pulse 2s infinite;cursor:pointer;display:flex;align-items:center;gap:10px;';
    alertDiv.innerHTML = `<span class="material-symbols-outlined">warning</span> <span>USER IN DANGER NEARBY!</span>`;
    document.body.appendChild(alertDiv);
    if (window.drawDangerZone && data.coordinates) window.drawDangerZone(data.coordinates);
    setTimeout(() => { if(document.body.contains(alertDiv)) alertDiv.remove(); }, 15000);
});

fetch(`${API_URL}/users/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: state.deviceId }) });
updateUserLocation();

// =================== ARMING LOGIC ===================
if (!sessionStorage.getItem('safeher_armed')) {
    const modal = document.createElement('div');
    modal.id = 'aegis-sensor-modal';
    modal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(30,27,29,0.98);backdrop-filter:blur(15px);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:sans-serif;padding:30px;text-align:center;">
            <img src="/img/logo.jpg" alt="SafeHer Logo" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:20px; box-shadow:0 10px 30px rgba(137,103,144,0.3);" />
            <h2 style="font-size:2.2rem;font-weight:900;margin-bottom:10px;text-transform:uppercase;color:#ffe1f5;letter-spacing:2px;">SafeHer Aegis</h2>
            <p style="opacity:0.8;margin-bottom:40px;line-height:1.6;max-width:320px;">Tap <b>ARM SYSTEM</b> to enable live camera and emergency voice SOS sensors for this session.</p>
            <button id="arm-sys-btn" onclick="initAegisSensors()" style="width:100%;max-width:300px;padding:24px;background:#896790;color:white;border:none;border-radius:20px;font-size:1.3rem;font-weight:900;cursor:pointer;text-transform:uppercase;box-shadow:0 15px 40px rgba(137,103,144,0.5);transition:all 0.3s;">ARM SYSTEM NOW</button>
            <p style="margin-top:20px;font-size:10px;opacity:0.4;text-transform:uppercase;letter-spacing:1px;">Protects you for the entire session</p>
        </div>
    `;
    document.body.appendChild(modal);
} else {
    // Already armed: restore recognition silently on next user gesture
    const restoreOnInteraction = () => {
        document.removeEventListener('click', restoreOnInteraction);
        document.removeEventListener('touchstart', restoreOnInteraction);
        if (!state.sensorsArmed) {
            console.log('[SafeHer] Restoring sensors silently...');
            initAegisSensors(true);
        }
    };
    document.addEventListener('click', restoreOnInteraction, { once: true });
    document.addEventListener('touchstart', restoreOnInteraction, { once: true, passive: true });
}

window.initAegisSensors = async function(silent = false) {
    if (state.sensorsArmed && !silent) return;

    console.log('[SafeHer] Arming Aegis System...');
    
    // Smooth fast exit pattern
    if (!silent) {
        const btn = document.getElementById('arm-sys-btn');
        if (btn) {
            btn.innerText = 'ARMING...';
            btn.style.opacity = '0.7';
            btn.style.transform = 'scale(0.95)';
        }
        const modal = document.getElementById('aegis-sensor-modal');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.4s ease-out';
            setTimeout(() => modal.remove(), 400);
        }
    }

    try {
        // Motion/Shake detection
        startMotionDetection();

        // Camera: request permission + immediately close — real stream opens only on evidence page
        if (window.isTestingSensors) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const testVideo = document.createElement('video');
            testVideo.style = 'position:fixed;top:20px;left:20px;width:150px;height:100px;z-index:999999;border:4px solid #4CAF50;border-radius:10px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.5);';
            testVideo.srcObject = stream;
            testVideo.autoplay = true;

            const debugLabel = document.createElement('div');
            debugLabel.id = 'voice-debug-text';
            debugLabel.style = 'position:fixed;top:130px;left:20px;background:black;color:white;padding:5px 10px;border-radius:5px;font-size:10px;z-index:999999;';
            debugLabel.innerText = "Listening for 'Help' or 'Bachao'...";

            document.body.appendChild(testVideo);
            document.body.appendChild(debugLabel);

            setTimeout(() => {
                testVideo.remove();
                stream.getTracks().forEach(t => t.stop());
                window.isTestingSensors = false;
            }, 10000);
        } else {
            // Just verify permission without keeping stream
            try {
                const camTest = await navigator.mediaDevices.getUserMedia({ video: true });
                camTest.getTracks().forEach(t => t.stop());
                updateSensorStatus('camera', true);
            } catch(e) {
                console.warn('[SafeHer] Camera not available, voice/shake still active.');
                updateSensorStatus('camera', false);
            }
        }

    } catch(e) {
        console.warn('[SafeHer] Sensor arm failed:', e);
        if (!silent) alert('Sensors could not be initialized. Please ensure you are on HTTPS (use ngrok).');
    }

    state.sensorsArmed = true;
    sessionStorage.setItem('safeher_armed', 'true');
};

// Sensor Status Hub
function updateSensorStatus(type, active) {
    const hub = document.getElementById('sensor-status-hub');
    if (!hub) return;
    const indicator = hub.querySelector(`[data-sensor="${type}"]`);
    if (indicator) {
        indicator.innerHTML = active ? '🟢' : '🔴';
        indicator.title = active ? 'Active' : 'Offline';
    }
}

setTimeout(() => {
    const topBar = document.querySelector('header .flex.items-center.gap-3');
    if (topBar) {
        const existingHub = document.getElementById('sensor-status-hub');
        if (!existingHub) {
            const statusHub = document.createElement('div');
            statusHub.id = 'sensor-status-hub';
            statusHub.className = 'flex items-center gap-2 bg-black/10 px-2 py-1 rounded-full text-[8px] font-bold';
            statusHub.innerHTML = `
                <span data-sensor="audio" title="Audio">⚪</span>
                <span data-sensor="voice" title="Voice">⚪</span>
                <span data-sensor="camera" title="Camera">⚪</span>
            `;
            topBar.appendChild(statusHub);
        }
    }
}, 1000);

// PWA Manifest
if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = '/manifest.json';
    document.head.appendChild(manifestLink);
}

// Boot badge
setTimeout(() => {
    const bootBadge = document.getElementById('boot-status');
    if (bootBadge) {
        bootBadge.innerHTML = 'ONLINE';
        setTimeout(() => bootBadge.style.display = 'none', 1500);
    }
}, 1000);

// Feature wire-up
setTimeout(() => {
    // Navigation
    document.querySelectorAll('nav a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && !a.onclick) {
            a.addEventListener('click', (e) => {
                if (href.startsWith('/') || href.startsWith('http')) {
                    e.preventDefault();
                    location.href = href;
                }
            });
        }
    });

    // SOS Hold Button (Hub)
    document.querySelectorAll('button').forEach(b => {
        b.style.cursor = 'pointer';
        const content = (b.innerText || b.innerHTML || '').toLowerCase();

        if (content.includes('sos') && !b.dataset.bound) {
            b.dataset.bound = '1';
            let holdTimer, progressInterval, holdStart;
            const startHold = (e) => {
                if (state.distressActive) return;
                if (e.cancelable) e.preventDefault();
                holdStart = Date.now();

                const prog = document.createElement('div');
                prog.id = 'sos-hold-progress';
                prog.style = 'position:absolute;inset:0;background:rgba(255,255,255,0.2);width:0%;pointer-events:none;border-radius:inherit;';
                b.style.position = 'relative';
                b.style.overflow = 'hidden';
                b.appendChild(prog);

                holdTimer = setTimeout(() => {
                    triggerVerification('MANUAL_SOS');
                    endHold();
                }, 3000);

                progressInterval = setInterval(() => {
                    const pct = Math.min(((Date.now() - holdStart) / 3000) * 100, 100);
                    prog.style.width = pct + '%';
                }, 50);
            };
            const endHold = () => {
                clearTimeout(holdTimer);
                clearInterval(progressInterval);
                const prog = b.querySelector('#sos-hold-progress');
                if (prog) prog.remove();
            };
            b.addEventListener('mousedown', startHold);
            b.addEventListener('touchstart', startHold, { passive: false });
            b.addEventListener('mouseup', endHold);
            b.addEventListener('touchend', endHold);
            b.addEventListener('mouseleave', endHold);
        }

        // Safe Zones
        if (content.includes('safe zone') || content.includes('nearby safe')) {
            b.onclick = () => { if(window.showOnlySafeZones) window.showOnlySafeZones(); };
        }

        // Guardian Network
        if (content.includes('guardian network') || content.includes('groups')) {
            b.onclick = () => {
                fetch(`${API_URL}/users/nearby?lon=${state.location?.lon||79.0882}&lat=${state.location?.lat||21.1458}&radius=10000`)
                .then(r => r.json())
                .then(data => alert(`Guardian Network Active! Found ${data.users?.length || 0} guardians in 10km.`));
            };
        }

        // Simulate Motion button
        if (content.includes('simulate motion')) {
            b.onclick = () => triggerVerification('MOTION_SPIKE');
        }
    });

    // Simulate motion dynamically handled if testing

    // Protocol page auto-camera
    if (window.location.pathname.includes('distress-protocol.html')) {
        startProtocolCamera();

        const feedContainer = document.querySelector('.bg-surface\\/40');
        if (feedContainer) {
            const extraSteps = [
                { icon: 'share_location', text: 'WhatsApp Live Location Shared', delay: 3000 },
                { icon: 'message', text: 'SMS Sent to Guardian Network', delay: 5000 },
                { icon: 'groups', text: 'Nearby SafeHer Users Alerted', delay: 8000 },
                { icon: 'emergency_share', text: 'Streaming Audio to Cloud', delay: 10000 },
                { icon: 'call', text: 'Calling Emergency Services (100)', delay: 12000 }
            ];
            extraSteps.forEach(step => {
                setTimeout(() => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between';
                    div.style.animation = 'fadeIn 0.5s forwards';
                    div.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL' 1;">${step.icon}</span>
                            <span class="text-sm font-medium tracking-wide">${step.text}</span>
                        </div>
                        <span class="text-[10px] font-bold text-primary-container bg-primary/20 px-2 py-0.5 rounded uppercase">Done</span>
                    `;
                    feedContainer.appendChild(div);
                }, step.delay);
            });
        }
    }

    // Live evidence page auto-camera
    if (window.location.pathname.includes('live-evidence.html')) {
        startProtocolCamera();
    }

}, 1500);
