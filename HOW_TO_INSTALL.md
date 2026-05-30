# Installing OrbMaster on Android

---

## ✅ OPTION 1 — Install as App (No APK needed, 2 minutes)

This uses Chrome's "Add to Home Screen" — it gives you a real app icon, fullscreen play, and works offline.

### Steps:
1. Make sure the OrbMaster folder is accessible from your Android phone.
   - Easiest: upload the whole OrbMaster folder to Google Drive or Dropbox.
   - Or: connect your phone via USB and copy the folder to your phone's storage.

2. On your Android phone, open **Chrome**.

3. Navigate to the `OrbMaster.html` file:
   - If on Google Drive: tap the file → it opens in Chrome.
   - If on phone storage: type `file:///sdcard/OrbMaster/OrbMaster.html` in Chrome's address bar.

4. Tap the **three-dot menu (⋮)** in Chrome → tap **"Add to Home Screen"**.

5. Name it **OrbMaster** → tap **Add**.

6. The game now appears on your home screen like a real app — fullscreen, no browser UI!

---

## 🔧 OPTION 2 — Build a True APK (Requires Android Studio)

This produces a real `.apk` file you can install directly on any Android device.

### Prerequisites:
- Node.js installed (https://nodejs.org)
- Android Studio installed (https://developer.android.com/studio)

### Steps:
```bash
# 1. Open a terminal in the OrbMaster folder

# 2. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Initialize (already have capacitor.config.json)
npx cap add android

# 4. Sync the web files
npx cap sync android

# 5. Open in Android Studio
npx cap open android
```

6. In Android Studio: **Build → Generate Signed Bundle/APK → APK**
7. Follow the signing wizard (create a keystore if you don't have one)
8. The `.apk` file will be in `android/app/build/outputs/apk/`

---

## 📱 Tips
- The game saves progress automatically.
- Works completely offline once installed.
- Portrait mode only (as designed).
