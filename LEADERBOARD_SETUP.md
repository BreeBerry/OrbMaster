# OrbMaster — Daily Leaderboard & Ranking: Setup

The game code is already wired up. To switch the leaderboard **on**, you just run one SQL file in your existing Supabase project. Until you do, the game behaves exactly as before — the leaderboard UI shows a friendly "not set up yet" message and nothing errors.

## One-time setup (≈2 minutes)

1. Go to [supabase.com](https://supabase.com) and open your project **`vmuthzemeiztttzzgfju`** (the same one the game already uses for online play).
2. In the left sidebar, click **SQL Editor** → **New query**.
3. Open `leaderboard_setup.sql` (in this folder), copy **everything**, paste it into the editor, and click **Run**.
4. You should see "Success. No rows returned." That's it — the leaderboard is live.

To sanity-check that the server agrees with the game, run this in the SQL editor:

```sql
select public.om_daily_info('2026-06-13');
```

The `code` it returns should read `["purple","teal","purple","pink"]` — the exact code the game generates for that day. If it matches, server-side verification is working.

## What players get

- **Daily Challenge board** — everyone solves the *same* secret code each day, ranked by fewest turns, then fastest time. New tab: **Campaign → 🏆 Leaderboard**.
- **PvP skill ladder** — an Elo rating from Play Online duels, with a **Daily / PvP Ladder** toggle on the same Leaderboard tab. After a ranked duel the results screen shows your Elo change.
- **Your rank** appears right on the results screen after you solve a daily ("Rank #4 of 128 today") or finish a duel ("1016 Elo, +16").
- **Global / Friends toggle** on both boards (friends come from your Google Play Games friends list).
- **Seasons & tiers** — monthly seasons. Daily solves earn season points; duels move your Elo. Tiers (shared names): Novice → Cipher → Adept → Savant → MindBreaker → OrbMaster.
- **Daily streaks** — a 🔥 streak badge on the Daily card and results for consecutive days solved. Longer streaks add bonus season points (up to +140 at a 15-day streak). The streak is computed server-side from real solve history, so it can't be faked. Streaks also display offline.
- **Shareable results** — a spoiler-free, Wordle-style emoji card after each daily solve (uses the native share sheet on mobile, or copies to the clipboard). Set `SHARE_URL` in `index.html` to your store/web link to append it to shares.
- **Ranked rematch** — after a duel, a one-tap Rematch re-challenges the same opponent with the same settings; challenges are clearly labeled as ranked.

## How fair-play is handled

- The day's code is identical for everyone and **the server re-derives it independently** to confirm a submitted solve actually cracks today's code — you can't post a fake win.
- Solve **time is measured server-side** (from a start token issued when the battle begins), so fast times can't be faked by editing the client.
- **PvP ladder uses two-sided corroboration:** an Elo change is applied only when *both* players report the same match and their results agree (one win + one loss, or both draw). A single player can't unilaterally claim a win against a real opponent; disagreeing reports are marked "disputed" and move no rating. Elo is computed server-side from both players' current ratings, and a one-row-per-match lock guarantees it's applied exactly once.
- All writes go through locked-down database functions; the public app key can't touch the tables directly.

### Known limitations (fine for launch, worth knowing)

- Like Wordle, since the code is the same for everyone, someone *could* share the answer in a community. Acceptable here because rewards are in-game fragments, not money.
- Player identity is the Google Play Games id the app already uses. With the public anon key, ids are self-asserted (same trust model as your current multiplayer). If you later want hard identity, add Supabase Auth or verify a Play Games token in an Edge Function — the schema is ready for it.

## If you ever change the daily generator

The secret code is produced by `getDailyChallenge()` in `index.html`. The SQL file contains a **faithful port** of that exact algorithm (`om_daily_info`). If you change the orb templates, pool logic, or the order of random draws in the JS, update `leaderboard_setup.sql` to match and re-run it, or the server will derive different codes than the client and reject valid solves. (The porting was verified bit-for-bit against the JS for multiple dates.)

## Updating an already-deployed project

If you ran an earlier version of this file, just re-run the whole updated `leaderboard_setup.sql` again — it's safe to run repeatedly (everything is `CREATE OR REPLACE` / `IF NOT EXISTS`) and won't disturb existing scores or ratings. The PvP ladder tables and functions are added at the bottom of the file.

## Known limitations (ladder)

Corroboration stops a player from faking a win against a *real* opponent, but because identity is still the self-asserted Play Games id, a determined cheater could in theory create a fake second account they control and feed themselves wins ("sybil" farming). Hardening that requires real authentication (Supabase Auth or a verified Play Games token), which the schema is ready to support later. For a casual in-game ladder this is an acceptable starting point.
