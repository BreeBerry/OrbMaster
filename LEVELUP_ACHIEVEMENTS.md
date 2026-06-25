# OrbMaster — Play Games Achievements (Level Up program)

This wires OrbMaster's 19 in-game achievements into **Google Play Games Services (PGS)**, which is a required Level Up guideline (milestone: **July 31, 2026**). Cloud save is already implemented; this closes the "Achievements with PGS" requirement.

## What's already done in code

- **Native plugin** (`android/app/src/main/java/.../PlayGamesPlugin.java`): added `unlockAchievement`, `incrementAchievement`, and `showAchievements` methods using `PlayGames.getAchievementsClient`.
- **Game code** (`www/index.html`): every time `grantAchievement()` fires, it also calls `PGS.unlockAchievement(...)`. On sign-in, `syncAchievementsToPGS()` pushes any already-earned achievements (idempotent). The Achievements screen shows a **🎮 View on Play Games** button on signed-in Android.
- A `PGS_ACHIEVEMENT_IDS` map is ready in `www/index.html` — **you paste the Play Console IDs into it** (step 3 below). Until then, PGS unlocking is skipped harmlessly.

## Step 1 — Create the achievements in Play Console

1. Go to **Play Console → (your app) → Grow → Play Games Services → Setup and management → Achievements**.
2. Click **Add achievement** and create all 19 below. For each:
   - **Name** (max 100 chars) and **Description** (max 500 chars) — use the table.
   - **Icon**: a 512×512 PNG (you can reuse the orb/emoji art; each needs one).
   - **Incremental**: **No** (all of OrbMaster's achievements are single-unlock).
   - **Initial state**: **Revealed** (or set the "surprise" ones to Hidden if you prefer).
   - **Points**: suggested values below (Play caps the total at **1000** across all achievements — these sum to exactly 1000).

| # | Internal key | Name | Description | Pts | Hidden? |
|---|---|---|---|---|---|
| 1 | first_blood | First Blood | Defeat your first boss. | 25 | No |
| 2 | swift | Swift Solver | Beat a boss in 3 turns or fewer. | 25 | No |
| 3 | one_turn | Read My Mind | Crack a code in a single turn. | 50 | Hidden |
| 4 | bare_hands | Bare Hands | Beat a boss with no ability orbs equipped. | 50 | No |
| 5 | campaign | MindMaster | Defeat all 10 campaign bosses. | 150 | No |
| 6 | forge_first | Apprentice Smith | Forge your first ability orb. | 10 | No |
| 7 | collector | Orb Collector | Forge all 12 ability orbs. | 75 | No |
| 8 | altar_max | Six Slots | Upgrade the MindBreaker Altar to Rank 6. | 50 | No |
| 9 | daily_first | Daily Grind | Complete a Daily Challenge. | 15 | No |
| 10 | streak_7 | On Fire | Reach a 7-day daily streak. | 50 | No |
| 11 | streak_30 | Unbreakable | Reach a 30-day daily streak. | 100 | No |
| 12 | duelist | Duelist | Win a ranked PvP duel. | 50 | No |
| 13 | gauntlet_5 | Gauntlet Initiate | Reach depth 5 in the Gauntlet. | 25 | No |
| 14 | gauntlet_10 | Gauntlet Adept | Reach depth 10 in the Gauntlet. | 50 | No |
| 15 | gauntlet_15 | Gauntlet Master | Reach depth 15 in the Gauntlet. | 50 | No |
| 16 | gauntlet_20 | Gauntlet Legend | Reach depth 20 in the Gauntlet. | 75 | No |
| 17 | fully_armed | Fully Armed | Assemble a full 4-orb Gauntlet loadout. | 25 | No |
| 18 | three_star | Perfectionist | Earn 3 stars on any boss. | 25 | No |
| 19 | all_stars | Grand Master | Earn 3 stars on all 10 bosses. | 100 | No |

## Step 2 — Copy each achievement's ID

After you save an achievement, Play Console shows its **ID** — a string that looks like `CgkI8aLxxxxxxxxEAIQAQ`. Copy each one. (You can see them all under the Achievements list, "ID" column.)

## Step 3 — Paste the IDs into the game

Open `www/index.html`, find `const PGS_ACHIEVEMENT_IDS = {` and fill in each value. Example:

```js
const PGS_ACHIEVEMENT_IDS = {
  first_blood:'CgkI8aLxxxxxxxxEAIQAQ',
  swift:'CgkI8aLxxxxxxxxEAIQAg',
  one_turn:'CgkI8aLxxxxxxxxEAIQAw',
  // …all 19…
};
```

The **internal key** in this file must match the table's internal key exactly (they already do).

## Step 4 — Build and test

1. From your PC: `npx cap sync android`, then build a signed release **AAB** in Android Studio (or your usual flow) and upload to **internal testing** on Play.
2. Add your Google account under **Play Games Services → Testers** so achievements work pre-publish.
3. Install the testing build, play, and confirm achievements unlock (a Play Games toast appears, and they show under **View on Play Games**).
4. When satisfied, **Publish** the Play Games Services configuration (Achievements have their own publish step, separate from the app release).

## Notes

- Unlocking is **idempotent** — re-unlocking does nothing, so the sign-in sync is safe.
- Achievements only unlock on **Android** when **signed in** to Play Games. The in-game achievement system (toasts + fragment rewards) keeps working everywhere, including iOS, regardless.
- The native methods require a rebuild of the Android app (`npx cap sync android`) so the new plugin code is included.
