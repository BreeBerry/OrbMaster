# OrbMaster — Shipping to the App Store from Windows (Codemagic)

You don't need a Mac. Codemagic runs real Macs in the cloud, builds + signs your Capacitor app, and uploads it to App Store Connect. You drive everything from your PC.

App bundle id (reuse the Android one): `com.breezybee.orbmaster`

---

## Identity on iOS — Game Center

Google Play Games is Android-only. On iOS the game uses **Game Center** as the identity provider instead (decided for v1). The app code is already platform-aware: it uses Play Games on Android, **Game Center on iOS**, and an anonymous fallback on the web. Because leaderboards, the ladder, and profile frames are all keyed off one id (`getMultiplayerId()`, which returns `gc_<id>` on iOS), they work on iPhone the moment Game Center signs the player in.

**Saves on iOS:** local-only for v1 (progress stays on the device). iCloud cross-device saves are the planned fast-follow. The code already skips cloud save/load on iOS so nothing errors.

### What you need to do for Game Center

1. **Install the plugin** (from your PC):
   ```
   npm install @openforge/capacitor-game-connect
   npx cap sync
   ```
   The app looks for the plugin as `CapacitorGameConnect`. (If you pick a different Game Center plugin, the field mapping in `PGS._gcSignIn()` in `index.html` may need a small tweak to match its response shape — it's written defensively to cover common shapes.)
2. **Enable the Game Center capability** for the App ID in the Apple Developer portal (web) and turn on Game Center for the app in App Store Connect.
3. That's it for identity — Game Center auto-authenticates at launch; there's no login button to design.

> Sign in with Apple is **not** needed for v1 (it's only required if you show another third-party login on iOS, which you won't — there's no Google button on the iOS build).

---

## Step 0 — Accounts (do these from your PC browser)

1. **Apple Developer Program** — enroll at [developer.apple.com](https://developer.apple.com) ($99/year). Enrollment can take a day or two to approve, so start now.
2. **Git repo** — push `C:\GitHub\OrbMaster` to GitHub/GitLab/Bitbucket (Codemagic builds from a repo). Make sure `node_modules/` and `android/app/build/` are git-ignored.
3. **Codemagic** — sign up at [codemagic.io](https://codemagic.io) with that Git account and connect the repo.

## Step 1 — Create the App Store Connect API key (lets Codemagic sign + upload, no Mac)

In **App Store Connect → Users and Access → Integrations → App Store Connect API**:
- Generate an API key (role: App Manager or Admin).
- Save the **Issuer ID**, **Key ID**, and the downloaded **`.p8`** file. You'll paste these into Codemagic.

This is what lets Codemagic create the distribution certificate and provisioning profile automatically — no Keychain, no CSR, no Mac.

## Step 2 — Create the app record

In **App Store Connect → Apps → +**:
- Platform iOS, bundle id `com.breezybee.orbmaster` (register the App ID in the Developer portal if prompted), name "OrbMaster", primary language, etc.

## Step 3 — Configure Codemagic

In the app's Codemagic settings:
- It will detect a **Capacitor** project. Use the Capacitor/iOS workflow.
- **Code signing (iOS):** add the App Store Connect API key from Step 1 and enable **automatic code signing**. Set the bundle id to `com.breezybee.orbmaster`.
- **Build steps** (the Capacitor workflow does most of this): install npm deps → `npx cap sync ios` (Codemagic adds the iOS platform on its Mac) → Xcode build → sign → **publish to App Store Connect / TestFlight**.
- **Xcode version:** pick **Xcode 26 or newer** — Apple requires the iOS 26 SDK for all uploads from **April 28, 2026** onward.

## Step 4 — Lock portrait on iOS

Android is already locked to portrait. For iOS, add a **pre-build script** in Codemagic (runs on their Mac after `cap sync`) to force the generated `Info.plist` to portrait-only:

```bash
PL=ios/App/App/Info.plist
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$PL"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$PL"
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations~ipad" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad array" "$PL"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad:0 string UIInterfaceOrientationPortrait" "$PL"
```

(Alternative: add the `@capacitor/screen-orientation` plugin and call `ScreenOrientation.lock({ orientation: 'portrait' })` at startup. The Info.plist patch is cleaner and avoids a rotation flash.)

## Step 5 — Listing assets (all doable on a PC)

- **Screenshots:** required at iPhone 6.7"/6.9" sizes, in **portrait**. Capture from the build (Codemagic can attach an iOS simulator run) or resize existing portrait captures.
- **App icon:** you already have one; Capacitor's asset tooling generates the iOS sizes.
- **Privacy:** you have `privacy.html` — host it and add the URL. Fill in App Store Connect's **privacy "nutrition" labels** (the app sends data to Supabase for leaderboards: disclose identifiers/usage data accordingly).
- **Age rating, description, keywords, support URL** — fill in App Store Connect.

## Step 6 — Build, then submit

- Trigger a Codemagic build → it lands in **TestFlight** automatically. Test it on a real iPhone via the TestFlight app.
- When happy, in App Store Connect attach the build to your version and **Submit for Review**.

---

## Rough cost & time

- Apple Developer Program: **$99/year** (required).
- Codemagic: free tier (limited monthly build minutes) is usually enough for a small app; paid if you build a lot.
- First submission review: typically a day or two.

## What to decide before launch

1. Ship iOS v1 with the **anonymous fallback** (simplest), or add **Sign in with Apple / Game Center** identity first?
2. Confirm no Google sign-in button shows on the iOS build (it won't, since Play Games is Android-only) to avoid Apple's Sign-in-with-Apple requirement.
