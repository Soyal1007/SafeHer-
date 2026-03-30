# SafeHer - Presentation Startup & Shutdown Guide

This guide contains the exact steps to reliably start the SafeHer platform for your live presentation. 
We need three things running: MongoDB (which automatically runs in the background), the Node Server, and the Ngrok Tunnel.

---

## 🟢 HOW TO START EVERYTHING (Pre-Presentation)

### Step 1: Open VS Code to the Project
Open VS Code to `D:\WS-02\zenz-platform` (where your backend and frontend folders live).

### Step 2: Start the Backend Server
1. Open a **new terminal** in VS Code (`Ctrl` + `` ` ``).
2. Navigate to the backend folder by dragging or typing:
   ```cmd
   cd backend
   ```
3. Start the Node/Express server:
   ```cmd
   npm run dev
   ```
   *You should see `🚀 ZenZ Server running on port 3000` and `✅ MongoDB Connected`.*

### Step 3: Start the Secure Tunnel (Ngrok)
*Ngrok is required because mobile browsers block Camera, Microphone, and Motion sensors on regular HTTP websites.*

1. Open a **second terminal window** (click the `+` icon in the VS Code terminal panel).
2. Navigate to where Ngrok is installed:
   ```cmd
   cd D:\WS-02\ngrok-bin
   ```
3. Start the tunnel to port 3000:
   ```cmd
   .\ngrok.exe http 3000
   ```
4. Look for the line that says **Forwarding**. Copy the secure URL (it looks like `https://xxxx-xx-xx-xx-xx.ngrok-free.app`).

### Step 4: Open on Mobile
1. Send that `https://...` link to your mobile phone (via WhatsApp, email, or Slack).
2. Open it in Chrome (Android) or Safari (iOS).
3. Tap **"Accept permissions"** when prompted for Camera and Microphone.

---

## 🔴 HOW TO TURN EVERYTHING OFF (Post-Presentation)

When you are finished presenting, you need to cleanly shut down the servers so they don't block ports for next time.

1. **Stop the Backend Server:**
   - Go to your first terminal window where `npm run dev` is running.
   - Click inside the terminal and press `Ctrl + C`. 
   - It will ask `Terminate batch job (Y/N)?`. Type `Y` and press Enter.

2. **Stop the Ngrok Tunnel:**
   - Go to your second terminal window where `ngrok` is running.
   - Click inside the terminal and press `Ctrl + C`.
   - The interface will disappear, meaning the tunnel is closed.

3. *(Optional)* **MongoDB Service**
   - MongoDB installs as a Windows Service and runs quietly in the background automatically. You never need to turn it on or off manually.

---

## 🚦 Troubleshooting Checklist for Live Demo
- **"The website won't load on my phone!"**
  Make sure your computer and your phone are connected to the internet. Double-check that `npm run dev` and `ngrok` are both actively running in your terminals without errors.
- **"The Mic/Camera won't turn on!"**
  Make sure you sent the `https://` version of the ngrok link, not the `http://` version. Browsers strictly enforce HTTPS for security features!
- **"SOS didn't fire!"**
  Ensure you are shaking the phone smoothly while speaking the distress word clearly. The system requires both signals within a 5-second window.
