# OrbMaster — Game Design Document

**Version:** 1.9 · June 2026
**Studio:** BreezyBee
**Status:** Live development (research-preview features in progress)

---

## 1. Overview

**OrbMaster** is a competitive code-cracking puzzle game built around the Mastermind deduction loop, dressed in a mystical "mind orb" theme. Players crack secret orb sequences set by boss characters (the **MindBreaker** and ten campaign bosses), earn **Orb Fragments** to forge ability orbs, climb a single-player campaign, and compete online through duels, a deterministic **Daily Challenge**, and global **leaderboards** with seasonal **ranking tiers**.

The design goal is a puzzle game with genuine competitive depth: a fair, verifiable daily for casual mass appeal (Wordle-style), and a skill ladder for committed players — both feeding into a season-based progression that cosmetics and prestige rewards reinforce.

### Vision pillars

- **Deduction first.** Every system serves the core "read the pegs, narrow the code" loop.
- **Fair competition.** The Daily is identical for everyone and server-verified; the ladder uses corroborated results. No pay-to-win.
- **Earned prestige.** Progress is expressed through tiers, streaks, and (planned) cosmetics that are visible to rivals.
- **Pick-up-and-play, stay-for-mastery.** A 4-orb daily is approachable; a 6-orb/12-color hard day is a real test.

### Platform & tech at a glance

- **Client:** single-page HTML/CSS/JS app (`www/index.html`), playable on web and wrapped for **Android** (Google Play Games integration).
- **Backend:** Supabase (Postgres + Realtime). Realtime channels power multiplayer; Postgres RPCs power leaderboards and the ladder.
- **Identity & saves:** Google Play Games Services (player id, display name, avatar, cloud saves), with anonymous fallback.
- **Offline:** service worker; campaign and Daily are playable offline, with online features degrading gracefully.

---

## 2. Core Gameplay Loop

1. Choose an opponent: a **campaign boss**, the **Daily Challenge** (MindBreaker), a **PvP duel**, or **vs the MindBreaker AI**.
2. The opponent sets a hidden **code** — a sequence of colored orbs of a fixed length (the *orb set*) drawn from a defined *orb pool*.
3. Each turn, submit a guess. Feedback returns as **pegs**: a **red peg** per orb that is the right color in the right position, a **white peg** per orb that is the right color in the wrong position.
4. Use deduction (and equipped **ability orbs**) to crack the code within **10 turns**.
5. Win to earn **Orb Fragments**, advance progression, and (online) post to leaderboards.
6. Spend fragments in the **Orb Forge** to craft ability orbs; upgrade the **MindBreaker Altar** to unlock larger orb sets.

---

## 3. Core Mechanics

### 3.1 Codes, pegs, and turns

- A **code** is an ordered list of orb colors of length *N* (the orb set size: 4, 5, or 6).
- **Duplicates are allowed** in codes (standard Mastermind), weighted so fresh colors appear more often than repeats.
- **Feedback** per guess: `reds` (correct color & position) and `whites` (correct color, wrong position), computed without double-counting.
- **Turn limit:** 10 per match. Certain abilities add extra turns.

### 3.2 The MindBreaker Altar (orb set size)

The Altar is the player's guess console; its **rank** determines how many orb slots a guess can hold.

| Rank | Slots | How obtained |
|------|-------|--------------|
| 1–4  | 4     | Default (auto-progresses early) |
| 5    | 5     | Purchased after Boss 5 — costs 150 Orange, 150 Blue, 100 Green, 100 Red |
| 6    | 6     | Purchased after Boss 7 — costs 200 Purple, 150 White, 150 Black, 100 Teal |

> The Daily Challenge **ignores** Altar rank — everyone can play any day's set size regardless of their rank (see §8).

---

## 4. Orbs

There are **12 orb colors**, each serving a dual role: a **puzzle color** that can appear in codes, and an **ability orb** that can be crafted and equipped for a passive or active effect.

### 4.1 Orb roster

| Orb | Rarity | Ability | Effect | Forge cost (frags) |
|-----|--------|---------|--------|------|
| Orange | Common | +1 Guess | +1 extra turn this match | 60 |
| Blue | Common | Undertow | Undo your last guess (turn refunded) | 50 |
| Green | Common | Reveal Wrong | Reveal one orb **not** in the code | 50 |
| Silver | Common | Lucky Find | +15% Uncommon loot chance (passive) | 50 |
| Red | Uncommon | Burn | Reveal a random correct position | 90 |
| Purple | Uncommon | +2 Guesses | +2 extra turns this match | 100 |
| Yellow | Uncommon | Disable | Disable the boss's special ability this match | 70 |
| Gold | Uncommon | Prospect | +20% Rare loot chance (passive) | 60 |
| Pink | Rare | Reveal 2 | Reveal the colors of 2 positions in the code (needs pool 8+) | 180 |
| White | Rare | +3 Guesses | +3 extra turns this match | 150 |
| Black | Rare | Insight | Choose a position — reveal its orb color | 130 |
| Teal | Rare | Purge 3 | Eliminate 3 orb colors that are NOT in the code (needs pool 8+) | 300 |

- **Passive orbs** (Silver, Gold) apply automatically when equipped.
- **Active orbs** are tapped during a match; each is single-use per match.
- A player equips **up to 4 ability orbs** per match.

### 4.2 Puzzle color unlocks

Players start with 5 colors (**Red, Blue, Yellow, Green, Orange**). Beating campaign bosses unlocks the rest, expanding both the codes players face and the orbs they can forge:

| Unlocked after | Color |
|---|---|
| Boss 3 | Silver |
| Boss 4 | Gold |
| Boss 5 | Purple |
| Boss 6 | Black |
| Boss 7 | White |
| Boss 8 | Pink |
| Boss 9 | Teal |

---

## 5. Campaign

A ten-boss single-player ladder. Each boss sets codes from a defined orb pool, has a fixed orb-set size, a loot table, and (most) a signature **special ability** that complicates deduction.

| # | Boss | Set | Special |
|---|------|-----|---------|
| 1 | Lemons | 4 | — |
| 2 | Templefrist | 4 | Freezes an orb color out of your picker for 2 turns at a time |
| 3 | Bigginsly | 4 | Hides peg feedback every 3rd guess (gives a cryptic clue instead) |
| 4 | Nanomic | 4 | Swaps two of your orbs every other guess |
| 5 | Natty D | 4 | Offers a high-stakes wager every 3 turns |
| 6 | Pretty Pea | 4 | — |
| 7 | Sir Louie | 4 | Blocks active abilities until you score 2+ reds in one guess |
| 8 | Queen Asabeth | 5 | Disables Yellow & transmutes one orb each guess until you score 4 reds |
| 9 | Elkgore | 5 | Scrambles his code once within the first 5 turns |
| 10 | Mad Martin | 6 | Each newly found correct position costs 1 turn (max 1/guess) |

- **Loot tables** shift from all-Common (Boss 1) to all-Rare (Boss 10), making later bosses the source of rare fragments.
- **Yellow (Disable)** counters a boss's special; **larger self-chosen sets** raise rewards (see §7).
- Each boss has flavor dialogue (taunts on entry, defeat, and victory).

### 5.1 Campaign completion

Beating Mad Martin (Boss 10) for the first time triggers a story ending and unlock reveal sequence:

- **Ending:** Mad Martin proclaims the player a **Battle-trained MindMaster** and sends them to test their skills online.
- **Reward — exclusive profile frame:** the **MindMaster** frame is unlocked permanently (equip from Profile). Configurable via `CAMPAIGN_FRAME` in code.
- **Multiplayer Specials unlocked:** the five boss-style Specials (§9.2) become purchasable in the Orb Forge, announced by a reveal modal.

### 5.2 Boss mastery (stars)

Each boss win is scored against three independent objectives, turning the 10 bosses into replayable mastery content:

1. ⭐ Defeat the boss.
2. ⭐ Solve in **par turns or fewer** (par = orb-set size + 2).
3. ⭐ Win **without using an ability orb** (pure deduction).

The best star count per boss is stored (`STATE.bossStars`) and shown on the campaign cards and the results screen. Earning 3 stars on one boss, and on all ten, grant achievements.

---

## 5A. Single-player meta systems

### Gauntlet (endless run)

An escalating solo run against the MindBreaker, launched from the title screen. Reuses the campaign battle engine with the MindBreaker as a synthetic boss; ignores unlocked colors/rank so anyone can play.

- **Gentle ramp:** orb-set size 4 (stages 1–5), 5 (6–12), 6 (13+); the pool widens ~1 colour every two stages toward 12. Starts easy, escalates steadily.
- **Ability draft (every 3 stages):** after clearing stages **2, 5, 8, 11** the player is offered **3 random ability orbs and picks 1** to add to a run-only loadout (carried as `providedOrbs`), up to **4 abilities**. Stages 1–2 are played with no abilities.
- **Performance-weighted rarity:** the draft's rarity odds scale with how efficiently you've been solving (total par ÷ total turns). Faster solves shift the odds toward uncommon/rare orbs; struggling keeps them common.
- **Boss specials (stages 12–20):** from stage 12 the MindBreaker gains a random campaign-style special each stage (freeze, hide-feedback, swap, scramble, turn-penalty, royal decree); specials stop after stage 20.
- **Flow & rewards:** clear a stage → **Next Stage** or **Bank & End Run** (a draft replaces the prompt on draft stages); fail (out of turns) ends the run. Reward = fragments scaled by depth. Local best depth is tracked and posted to an online **Gauntlet leaderboard** (best depth, then fewest total turns — honor-system, since the run is client-side). Depth milestones (5/10/15) grant achievements.

### Achievements

~19 goals spanning campaign, daily, gauntlet (incl. depth 5/10/15/20 and a full 4-orb draft loadout), PvP, forging, and mastery (e.g., "Read My Mind" — 1-turn solve, "Bare Hands" — beat a boss with no orbs equipped, "Unbreakable" — 30-day streak, "Grand Master" — 3 stars on every boss). Each grants a fragment reward on unlock, with a celebratory toast. Viewed from the Profile (`🏅 Achievements`). Stored in `STATE.achievements`; threshold goals are re-checked at key moments via `checkAchievements()`, event goals granted inline.

---

## 6. Economy — Orb Fragments & the Orb Forge

**Orb Fragments** are the single currency, tracked **per color**. They are earned by winning matches and the Daily, and spent in the **Orb Forge** to craft ability orbs and Altar upgrades.

- Each match win pays out fragments split across **4 reward batches**, each rolled against the boss's loot table to determine rarity, then assigned to a specific color.
- Fragments also gate Altar upgrades (§3.2) and, post-campaign, **MindBreaker Specials** (§9).
- **Planned sink:** a cosmetics vendor in the Forge (see §14), giving long-term players a fragment use beyond ability orbs.

### 6.1 Ability upgrades (v1.10)

Once an orb is forged, the Forge offers a one-time **ability upgrade** for that orb, paid in its own color's fragments. Upgrades are permanent (`STATE.upgradedOrbs[color]`) but only take effect in single-player **Campaign and Gauntlet** — they are intentionally suppressed in the **Daily Challenge** (shared leaderboard) and **Multiplayer** (PvP) to keep those fair. Gating: `spUp(color)` requires `BATTLE && !BATTLE.isDaily`; MP is behind the `MP_UPGRADES_ENABLED` flag (currently `false`). Two upgrade kinds:

- **Charge upgrades** add a 2nd use per match (Blue Undertow, Black Pierce). Tracked via `abilityUses` counts; an orb is only "exhausted" once its charges run out (`orbMaxCharges`).
- **Effect upgrades** strengthen the one-shot effect: Orange/Purple/White give one extra guess more (+2/+3/+4); Red Burn reveals 2 positions; Pink Insight reveals 3; Teal Purge removes 4; Green Hindsight also reveals a true position; Yellow Nullify also reveals a wrong color; Silver/Gold loot boosts rise to +30%/+35%.

The Forge card shows the **color name above** the orb icon and the **ability name below** it, with the upgrade description + cost beneath the Forge button.

### 7. Reward Formula (campaign / boss wins)

```
basePerOrb   = 50
penalty      = 5 per turn used beyond the first 2 (min 5 per orb)
rawFragments = earnedPerOrb × orbSetSize
             × setMultiplier   (5-orb ×1.3, 6-orb ×1.7)
             × 1.2  if Boss 7+
```

Reward is then distributed across 4 batches by the boss's loot rarity table. Solving in turns 1–2 yields the maximum; ability orbs that add turns do **not** reduce reward.

---

## 8. Daily Challenge (flagship)

A once-a-day boss battle against the **MindBreaker**, played on the campaign battle engine (the MindBreaker sets one code; the player cracks it).

### 8.1 Design rules

- **Deterministic & identical for everyone.** The day's difficulty, orb pool, helper orbs, secret code, and theme are all derived from the **local calendar date** via a seeded PRNG — every player gets the exact same puzzle for a given date (Wordle-style), unlocking at their own local midnight. (This shared code is what makes the leaderboard verifiable.)
- **Rank/unlock agnostic.** The Daily ignores the player's Altar rank and unlocked colors. Pools can include orbs the player hasn't unlocked yet; anyone can play any day.
- **Unlimited replays, reward once.** Fragments are paid on the first solve of the day; replays are free for practice and leaderboard improvement.

### 8.2 Difficulty rotation

Twelve templates, selected deterministically per day (weighting ≈ 42% easy / 42% medium / 17% hard):

| Tier | Templates (orb set / pool size) | Reward weight |
|------|---|---|
| Easy | 4/5, 4/6, 4/7, 5/6, 5/7 | ×1.0 |
| Medium | 4/8, 5/8, 6/7, 6/8, 6/9 | ×1.3 |
| Hard | 6/10, 6/12 | ×1.7 |

`baseReward = orbSet × poolSize × 12 × tierWeight` (≈240 frags on an easy day up to ≈1,470 on the hardest).

### 8.3 Helper orbs & rewards

- The match **provides** free helper orbs to keep harder days fair: **0 on easy, 2 on medium, 3 on hard**, drawn deterministically from the solve-helpful set (extra-guess and reveal orbs).
- **Hard days guarantee a rare-color fragment** in the payout.
- The pool may include orbs the player doesn't own — they still appear in the picker.

### 8.4 Streaks

- Solving on consecutive days builds a **🔥 streak** (with a personal best), shown on the Daily card and results, and synced offline from local state.
- A **server-verified streak bonus** is folded into season points: `min(streak − 1, 14) × 10` (up to +140 at a 15-day streak). Because it's derived from real solve history, it can't be faked.

### 8.5 Presentation

- The MindBreaker appears as a full boss with dedicated art (`MindBreaker Boss.png`).
- The battle theme **alternates by day**: main theme on even-numbered days, theme 2 on odd days.

### 8.6 Shareable results

After a solve, players can share a **spoiler-free, Wordle-style** card: header (date, tier, turns), an emoji peg grid (🟥 correct, 🟨 right-color, ⬛ miss), and streak. Uses the native share sheet on mobile, clipboard elsewhere. An optional `SHARE_URL` appends a store/web link to drive acquisition.

---

## 9. Multiplayer & MindBreaker Specials

### 9.1 PvP duels

Two players each set a secret code for the other, then race to crack first — fastest solver wins; if neither solves in 10 rounds, both lose (a draw on the ladder).

- **Matchmaking:** random match, **6-character room codes**, or **challenge a friend** from the friends list. The host selects the orb-set size and pool.
- **Abilities** carry over from the player's equipped loadout. Lockstep rounds make a local opponent feel live.

### 9.2 MindBreaker Specials (post-campaign)

Unlocked once all 10 bosses are beaten. Players may own many but **equip one** — a single-use, tap-to-activate boss-style attack in duels.

| Special | Effect | Cost |
|---|---|---|
| ❄️ Temple Ice | Freeze a random orb color in the opponent's picker for 2 rounds | 250 Blue, 250 White |
| 🌫️ Brute Fog | Hide the peg feedback on the opponent's next guess | 250 Green, 250 Black |
| 🔀 Nano Swap | Swap two orbs in the opponent's next submitted guess | 300 Silver, 200 Orange |
| 👑 Royal Transmute | Transmute one orb in the opponent's next guess to a random color | 250 Purple, 250 Gold |
| 🌀 Feral Scramble | Scramble your **own** code (first 4 rounds only) | 250 Teal, 250 Pink |

### 9.3 Vs the MindBreaker AI (casual)

A non-ranked practice duel against a local Mastermind-solving AI. The AI plays a deliberately imperfect minimax (tunable mistake chance) so players have a fair shot, and it mirrors the player's equipped Special.

---

## 10. Leaderboards & Ranking

### 10.1 Daily leaderboard

- Everyone solves the same code, ranked by **fewest turns, then fastest time**.
- The server **independently re-derives the day's code** to verify a submitted solve actually cracks it; solve **time is measured server-side** (start token at battle begin), so neither can be faked.
- **Global / Friends** filter (friends from the Play Games list). Your rank shows on the results screen.

### 10.2 Season points & tiers

Each daily solve earns season points (tier base + speed bonus + streak bonus). Monthly seasons. Tier names are shared across systems:

**Novice → Cipher → Adept → Savant → MindBreaker → OrbMaster**

Season-point thresholds: Cipher 400, Adept 1,000, Savant 2,000, MindBreaker 3,500, OrbMaster 5,500.

### 10.3 PvP skill ladder (Elo)

- Ranked duels feed a seasonal **Elo** rating (start 1,000, K-factor 32, zero-sum).
- **Corroboration anti-cheat:** an Elo change applies only when **both** players' reports of a match agree (one win + one loss, or both draw). Disagreements are "disputed" and move no rating; a one-row-per-match lock applies Elo exactly once.
- Elo tier thresholds: Cipher 1,050, Adept 1,200, Savant 1,400, MindBreaker 1,600, OrbMaster 1,800.
- **Rematch:** after a duel, one tap re-challenges the same opponent with the same settings.
- Same Global/Friends filter; the Leaderboard tab toggles **Daily / PvP Ladder**.

### 10.4 Known integrity limitations

Identity is the self-asserted Play Games id (consistent with the existing multiplayer model). The shared daily code can be shared Wordle-style; corroboration stops unilateral fake wins but not a determined "sybil" second account. Hardening path: Supabase Auth or verified Play Games tokens. Acceptable for the current casual-stakes (in-game fragment) design.

---

## 11. Social Features

- **Friends:** pulled from Google Play Games, plus in-game friends added after random matches. Online presence and direct challenges/invites via Realtime presence.
- **Invites & rematches:** banner notifications with one-tap accept.
- **Shareable daily results** (§8.6) for organic growth.

---

## 12. Progression & Retention Summary

| System | Drives |
|---|---|
| Campaign (10 bosses) | Onboarding, color/orb unlocks, early goals |
| Orb Forge & Altar | Mid-term build goals, currency sink |
| Daily Challenge | **Daily return** (the core retention engine) |
| Streaks | Habit formation + season-point bonus |
| Season points & tiers | Monthly climb, reset-and-rechase |
| PvP Elo ladder | Skill expression, rivalry |
| Shareable results | Acquisition / virality |
| Profile frames | Long-term prestige & aspiration (shipped) |
| Gauntlet (endless) | Solo endgame depth + score chase (shipped) |
| Achievements | Long-tail goals + fragment rewards (shipped) |
| Boss mastery stars | Replayability of campaign bosses (shipped) |

---

## 13. Technical Architecture

- **Client:** one `index.html` containing all markup, styles, and logic; loads `supabase-js` from CDN.
- **State:** `localStorage` (per-player keyed when signed in), mirrored to **Play Games cloud saves**; migration layer for schema changes.
- **Multiplayer:** Supabase **Realtime channels** (broadcast + presence) per room; lockstep round protocol; host-minted shared **match id** for ladder corroboration.
- **Leaderboards/ladder:** Supabase **Postgres + SECURITY DEFINER RPCs** (`leaderboard_setup.sql`). All writes go through locked-down functions; the public anon key can't touch tables directly. The daily PRNG is ported to plpgsql (verified bit-for-bit vs JS) so the server can re-derive codes.
- **Identity:** platform-aware — Google Play Games on Android (`pgs_` ids), Game Center on iOS (`gc_` ids), anonymous stable id (`anon_`) on web/unsigned. All keyed through `getMultiplayerId()`, so leaderboards/ladder/frames work across platforms. Cloud saves: Play Games on Android, local-only on iOS for v1 (iCloud planned).
- **Audio:** procedural Web Audio SFX + per-boss MP3 tracks (including two alternating MindBreaker daily themes).
- **Offline:** service worker caches the app; campaign + Daily work offline, online features no-op gracefully when unconfigured/disconnected.

---

## 14. Cosmetics

Cosmetics are pure prestige (no balance impact) and, crucially, **visible to rivals on leaderboards** to drive aspiration. (Note: Google Play Games profiles can't be customized by the game — these live entirely inside OrbMaster.)

### 14.1 Profile frames (shipped)

Illustrated, animated avatar frames, one per ranking tier. Each is a transparent-center PNG in `www/Images/Frames/` with a live CSS effect layer over it:

| Frame | Art | Effect | Unlock tier |
|---|---|---|---|
| Steel | brushed metal | metallic glint sweep | Novice |
| Circuit | engraved cyber ring | energy pulse + breathing glow | Cipher |
| Vine | navy & gold w/ gem | gem sparkle + gold shimmer | Adept |
| Runic | bronze w/ gems | gem pulses + rune flicker | Savant |
| Obsidian | shard ring | ember flicker + rising sparks | MindBreaker |
| Prismatic | crystal | rainbow shimmer + sparkle flares | OrbMaster |

- **Earned permanently**, unlocked by reaching the matching tier in **either** the season-points ladder **or** the Elo ladder (whichever is higher).
- **Equipped** from the Profile screen frame picker (shows only unlocked frames); shown around the avatar on the home screen, profile, and the player's leaderboard rows.
- **Visible to others:** the equipped frame is stored on the player's profile (`om_set_frame`) and joined into the leaderboard reads, so rivals see your frame on the board.
- **Data-driven:** adding a future frame = drop a PNG in `Frames/` + one entry in the `FRAMES` registry (and an effect, if new). System is built to extend.

**Special frames** (non-tier, unlocked by other means) live alongside the tier frames in the registry: `mindmaster` (the campaign-completion reward — see §5.1), plus a staged set — `cyber`, `sapphire`, `ruby`, `arcane`, `relic`, `cosmic`, `glacier` — reserved for future unlocks.

**Code-unlock frames.** Frames can also be unlocked by redeeming a code in the Profile frame picker. The `FRAME_CODES` map (id-keyed, case-insensitive) maps a code to a frame; redeeming unlocks + auto-equips it permanently. The first is the creator's `dev` frame ("Creator" crest) via code `80spride`. Codes live client-side, so they're shareable promo codes rather than true secrets — for revocable/secret codes, validate via a Supabase RPC later. Ornate non-ring frames (like `dev`) use a per-frame `inner: {scale, top}` (and optional `onTop`) so the avatar sits correctly in the artwork's opening.

### 14.2 Planned cosmetics

- **Home-screen backgrounds** — unlockable, selectable title scenes.
- **Nameplates & titles** — cosmetic titles and colored nameplates shown on boards (e.g., "Season 1 OrbMaster").
- **Orb skins & victory effects** — alternate orb art, Altar reskins, win flourishes.
- **Profile badges** — milestone emblems (100-day streak, all bosses, season top-10).

**Distribution (future):** end-of-season **exclusive** tier rewards (scarcity), streak milestones (7/30/100 days), daily top-10 finishes, a free season track, and a fragment-priced cosmetics shop.

---

## 15. Roadmap / Open Questions

- Profile frames shipped (§14.1); next cosmetics: home-screen backgrounds, then nameplates/titles.
- Decide cosmetics economy: earn-only vs. also fragment-buyable.
- Milestone "share your streak" prompts (7/30/100) to strengthen the viral loop.
- Optional integrity hardening (real auth) if competitive stakes rise.
- Possible future: clans/teams, weekly events, alternate daily modes.

---

## Appendix — Key Constants (current)

- Turn limit: **10**. Orb sets: **4 / 5 / 6**. Colors: **12**.
- Campaign base reward: **50/orb**, −5/turn beyond 2 (min 5/orb); set ×1.3 (5) / ×1.7 (6); Boss 7+ ×1.2.
- Daily reward: `set × pool × 12 × tier` (easy 1.0 / med 1.3 / hard 1.7); hard guarantees a rare.
- Daily helper orbs: easy 0 / med 2 / hard 3. Streak bonus: `min(streak−1,14)×10`.
- Season tiers (points): 400 / 1,000 / 2,000 / 3,500 / 5,500.
- Elo: start **1,000**, K **32**; tiers at 1,050 / 1,200 / 1,400 / 1,600 / 1,800.
