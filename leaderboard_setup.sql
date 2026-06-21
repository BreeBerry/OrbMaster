-- ════════════════════════════════════════════════════════════════════════
--  OrbMaster — Daily Challenge Leaderboard & Ranking  (Supabase / Postgres)
--  Paste this ENTIRE file into the Supabase SQL Editor and run it once.
--  Project: vmuthzemeiztttzzgfju  (the same project the game already uses)
--
--  What it creates:
--    • Tables: om_profiles, om_daily_scores, om_daily_sessions
--    • A faithful port of the game's deterministic daily generator, so the
--      server can independently re-derive today's secret code and verify solves
--    • RPCs the game calls: om_daily_start, om_daily_submit,
--      om_daily_leaderboard, om_daily_friends, om_daily_my_rank,
--      om_season_leaderboard, om_my_season
--  All writes go through SECURITY DEFINER functions; direct table writes are
--  not granted to the anon key. Re-running this file is safe (idempotent).
-- ════════════════════════════════════════════════════════════════════════

-- ── Tables ───────────────────────────────────────────────────────────────
create table if not exists public.om_profiles (
  player_id    text primary key,
  display_name text not null default 'Player',
  avatar_url   text,
  frame        text,
  updated_at   timestamptz not null default now()
);
alter table public.om_profiles add column if not exists frame text;

create table if not exists public.om_daily_sessions (
  id         uuid primary key default gen_random_uuid(),
  player_id  text not null,
  date_key   text not null,
  started_at timestamptz not null default now()
);
create index if not exists om_sessions_lookup on public.om_daily_sessions(player_id, date_key);

create table if not exists public.om_daily_scores (
  player_id    text not null,
  date_key     text not null,          -- 'YYYY-MM-DD' (UTC)
  display_name text not null default 'Player',
  avatar_url   text,
  turns        int  not null,
  solve_ms     int  not null,
  season       text not null,          -- 'YYYY-MM'
  points       int  not null default 0,
  created_at   timestamptz not null default now(),
  primary key (player_id, date_key)
);
create index if not exists om_scores_board  on public.om_daily_scores(date_key, turns, solve_ms);
create index if not exists om_scores_season on public.om_daily_scores(season);

-- Lock the tables down: RLS on, no direct policies. SECURITY DEFINER RPCs below
-- run as the table owner and bypass RLS, so they remain the only access path.
alter table public.om_profiles       enable row level security;
alter table public.om_daily_sessions enable row level security;
alter table public.om_daily_scores   enable row level security;

-- ── Deterministic daily generator (mirror of the JS in index.html) ─────────
-- 32-bit helpers. Multiply uses numeric to avoid 64-bit overflow.
create or replace function public.om_imul(a bigint, b bigint) returns bigint
  language sql immutable as $$
  select ((a::numeric * b::numeric) % 4294967296)::bigint;
$$;

-- mulberry32 step: takes state, returns array[new_state, value(uint32)]
create or replace function public.om_rng(a bigint) returns bigint[]
  language plpgsql immutable as $$
declare t bigint; v bigint;
begin
  a := (a + 1831565813) % 4294967296;                       -- 0x6D2B79F5
  t := public.om_imul((a # (a / 32768)), (a | 1));          -- imul(a^(a>>>15), 1|a)
  t := (((t + public.om_imul((t # (t / 128)), (t | 61))) % 4294967296) # t);
  v := (t # (t / 16384)) % 4294967296;                      -- (t^(t>>>14))>>>0
  return array[a, v];
end;
$$;

-- xmur3-style string hash (mirror of dailyHashSeed)
create or replace function public.om_hash(s text) returns bigint
  language plpgsql immutable as $$
declare h bigint; i int;
begin
  h := (1779033703 # length(s)) % 4294967296;
  for i in 1..length(s) loop
    h := public.om_imul((h # ascii(substr(s, i, 1))), 3432918353);
    h := (((h * 8192) % 4294967296) | (h / 524288)) % 4294967296;  -- (h<<13)|(h>>>19)
  end loop;
  return h % 4294967296;
end;
$$;

-- Re-derive the full daily config for a date_key. Returns
-- { code: [...], tier: 'easy|medium|hard', code_size: int, pool_size: int }
create or replace function public.om_daily_info(p_key text) returns jsonb
  language plpgsql immutable as $$
declare
  orb  text[] := array['red','blue','yellow','green','orange','purple','white','black','teal','silver','gold','pink'];
  csz  int[]  := array[4,4,4,5,5,4,5,6,6,6,6,6];
  psz  int[]  := array[5,6,7,6,7,8,8,7,8,9,10,12];
  tr   text[] := array['easy','easy','easy','easy','easy','medium','medium','medium','medium','medium','hard','hard'];
  a bigint; r bigint[]; idx int; cs int; ps int;
  colors text[]; tmp text; k int; j int; c int;
  code text[] := '{}';
begin
  a := public.om_hash('orbmaster-daily-' || p_key);
  r := public.om_rng(a); a := r[1];
  idx := ((r[2] * 12) / 4294967296)::int + 1;          -- 1-based template index
  cs := csz[idx]; ps := psz[idx];
  colors := orb;                                       -- 1-based copy of 12 colors
  -- Fisher–Yates matching JS: for k=11..1: j=floor(rng*(k+1)); swap(k,j)  [JS 0-based]
  for k in reverse 11..1 loop
    r := public.om_rng(a); a := r[1];
    j := ((r[2] * (k + 1)) / 4294967296)::int;         -- JS j in 0..k
    tmp := colors[k + 1]; colors[k + 1] := colors[j + 1]; colors[j + 1] := tmp;
  end loop;
  for c in 1..cs loop
    r := public.om_rng(a); a := r[1];
    j := ((r[2] * ps) / 4294967296)::int;              -- 0..ps-1
    code := array_append(code, colors[j + 1]);
  end loop;
  return jsonb_build_object('code', to_jsonb(code), 'tier', tr[idx], 'code_size', cs, 'pool_size', ps);
end;
$$;

-- Points for a solve: tier base + speed bonus (fewer turns = more).
create or replace function public.om_daily_points(p_tier text, p_turns int) returns int
  language sql immutable as $$
  select (case p_tier when 'hard' then 275 when 'medium' then 175 else 100 end)
       + greatest(0, (11 - p_turns)) * (case p_tier when 'hard' then 22 when 'medium' then 14 else 8 end);
$$;

-- Season tier name from accumulated season points.
create or replace function public.om_tier(p_points int) returns text
  language sql immutable as $$
  select case
    when p_points >= 5500 then 'OrbMaster'
    when p_points >= 3500 then 'MindBreaker'
    when p_points >= 2000 then 'Savant'
    when p_points >= 1000 then 'Adept'
    when p_points >=  400 then 'Cipher'
    else 'Novice' end;
$$;

-- ── RPCs the client calls ──────────────────────────────────────────────────

-- Start a run: records a server-side start time, returns a session token.
create or replace function public.om_daily_start(p_player_id text, p_date_key text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into public.om_daily_sessions(player_id, date_key) values (p_player_id, p_date_key)
  returning id into new_id;
  return new_id;
end;
$$;

-- Submit a solve. Verifies the final guess equals today's real code, measures
-- server-side time when a session token is supplied, stores the player's BEST
-- result for the day, and returns rank info.
create or replace function public.om_daily_submit(
  p_player_id text, p_date_key text, p_display_name text, p_avatar_url text,
  p_guesses jsonb, p_client_ms int, p_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  info jsonb; code jsonb; turns int; v_ms int; started timestamptz;
  season text; tier text; pts int; v_rank int; v_total int;
  v_streak int := 1; v_check date; v_bonus int;
begin
  if p_player_id is null or p_player_id = '' then
    return jsonb_build_object('ok', false, 'error', 'no_player');
  end if;
  if jsonb_typeof(p_guesses) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_payload');
  end if;
  turns := jsonb_array_length(p_guesses);
  -- Base limit is 10, but extra-guess helper orbs (orange/purple/white) can
  -- legitimately push a solve past 10 — allow headroom, cap for sanity only.
  if turns < 1 or turns > 30 then
    return jsonb_build_object('ok', false, 'error', 'bad_turns');
  end if;

  info := public.om_daily_info(p_date_key);
  code := info -> 'code';
  -- The final guess must exactly equal today's real code.
  if (p_guesses -> (turns - 1)) is distinct from code then
    return jsonb_build_object('ok', false, 'error', 'not_solved');
  end if;

  -- Server-measured time when a valid session exists, else fall back to client.
  if p_session_id is not null then
    select started_at into started from public.om_daily_sessions
      where id = p_session_id and player_id = p_player_id and date_key = p_date_key;
    if found then v_ms := greatest(0, (extract(epoch from (now() - started)) * 1000)::int); end if;
  end if;
  if v_ms is null then v_ms := greatest(0, coalesce(p_client_ms, 0)); end if;

  season := substr(p_date_key, 1, 7);
  tier   := info ->> 'tier';
  pts    := public.om_daily_points(tier, turns);

  -- Streak = consecutive prior days this player solved, +1 for today. Bonus
  -- caps at a 15-day streak (+140). Streak is derived from real solve history,
  -- so it can't be faked by the client.
  v_check := p_date_key::date - 1;
  loop
    exit when not exists (select 1 from public.om_daily_scores
      where player_id = p_player_id and date_key = to_char(v_check, 'YYYY-MM-DD'));
    v_streak := v_streak + 1;
    v_check := v_check - 1;
    exit when v_streak >= 60;
  end loop;
  v_bonus := least(v_streak - 1, 14) * 10;
  pts := pts + v_bonus;

  insert into public.om_daily_scores(player_id, date_key, display_name, avatar_url, turns, solve_ms, season, points)
  values (p_player_id, p_date_key, coalesce(nullif(p_display_name,''),'Player'), p_avatar_url, turns, v_ms, season, pts)
  on conflict (player_id, date_key) do update set
    turns       = least(om_daily_scores.turns, excluded.turns),
    solve_ms    = case when excluded.turns < om_daily_scores.turns then excluded.solve_ms
                       when excluded.turns = om_daily_scores.turns then least(om_daily_scores.solve_ms, excluded.solve_ms)
                       else om_daily_scores.solve_ms end,
    points      = greatest(om_daily_scores.points, excluded.points),
    display_name= excluded.display_name,
    avatar_url  = excluded.avatar_url;

  insert into public.om_profiles(player_id, display_name, avatar_url, updated_at)
  values (p_player_id, coalesce(nullif(p_display_name,''),'Player'), p_avatar_url, now())
  on conflict (player_id) do update set
    display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = now();

  select count(*) + 1 into v_rank
    from public.om_daily_scores o,
         (select s.turns mt, s.solve_ms mm from public.om_daily_scores s
            where s.player_id = p_player_id and s.date_key = p_date_key) me
   where o.date_key = p_date_key
     and (o.turns < me.mt or (o.turns = me.mt and o.solve_ms < me.mm));
  select count(*) into v_total from public.om_daily_scores where date_key = p_date_key;

  return jsonb_build_object('ok', true, 'turns', turns, 'solve_ms', v_ms,
                            'points', pts, 'streak', v_streak, 'streak_bonus', v_bonus,
                            'rank', v_rank, 'total', v_total);
end;
$$;

-- Today's board: top N by fewest turns, then fastest time. (Drops needed because
-- the return type gained a `frame` column.)
drop function if exists public.om_daily_leaderboard(text, int);
create or replace function public.om_daily_leaderboard(p_date_key text, p_limit int default 100)
  returns table(rank bigint, player_id text, display_name text, avatar_url text, turns int, solve_ms int, points int, frame text)
  language sql security definer set search_path = public stable as $$
  select rank() over (order by ds.turns asc, ds.solve_ms asc), ds.player_id, ds.display_name, ds.avatar_url, ds.turns, ds.solve_ms, ds.points, p.frame
  from public.om_daily_scores ds left join public.om_profiles p on p.player_id = ds.player_id
  where ds.date_key = p_date_key
  order by ds.turns asc, ds.solve_ms asc limit greatest(1, least(p_limit, 500));
$$;

-- Same board, filtered to a set of friend ids (keeps each player's GLOBAL rank).
drop function if exists public.om_daily_friends(text, text[]);
create or replace function public.om_daily_friends(p_date_key text, p_ids text[])
  returns table(rank bigint, player_id text, display_name text, avatar_url text, turns int, solve_ms int, points int, frame text)
  language sql security definer set search_path = public stable as $$
  select * from (
    select rank() over (order by ds.turns asc, ds.solve_ms asc) rank, ds.player_id, ds.display_name, ds.avatar_url, ds.turns, ds.solve_ms, ds.points, p.frame
    from public.om_daily_scores ds left join public.om_profiles p on p.player_id = ds.player_id
    where ds.date_key = p_date_key
  ) q
  where q.player_id = any(p_ids)
  order by q.rank limit 200;
$$;

-- A single player's rank/score for a given day.
create or replace function public.om_daily_my_rank(p_date_key text, p_player_id text)
  returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_rank int; v_total int; v_turns int; v_ms int; v_pts int;
begin
  select turns, solve_ms, points into v_turns, v_ms, v_pts
    from public.om_daily_scores where player_id = p_player_id and date_key = p_date_key;
  select count(*) into v_total from public.om_daily_scores where date_key = p_date_key;
  if v_turns is null then
    return jsonb_build_object('ranked', false, 'total', v_total);
  end if;
  select count(*) + 1 into v_rank from public.om_daily_scores o
   where o.date_key = p_date_key
     and (o.turns < v_turns or (o.turns = v_turns and o.solve_ms < v_ms));
  return jsonb_build_object('ranked', true, 'rank', v_rank, 'total', v_total,
                            'turns', v_turns, 'solve_ms', v_ms, 'points', v_pts);
end;
$$;

-- Season standings (sum of daily points in a 'YYYY-MM' season).
create or replace function public.om_season_leaderboard(p_season text, p_limit int default 100)
  returns table(rank bigint, player_id text, display_name text, avatar_url text, points bigint, tier text, days int)
  language sql security definer set search_path = public stable as $$
  select rank() over (order by sum(points) desc),
         player_id, max(display_name), max(avatar_url),
         sum(points)::bigint, public.om_tier(sum(points)::int), count(*)::int
  from public.om_daily_scores where season = p_season
  group by player_id
  order by sum(points) desc limit greatest(1, least(p_limit, 500));
$$;

-- A player's season points, tier and rank.
create or replace function public.om_my_season(p_season text, p_player_id text)
  returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_pts int; v_rank int; v_total int;
begin
  select coalesce(sum(points),0) into v_pts from public.om_daily_scores
    where season = p_season and player_id = p_player_id;
  select count(*) into v_total from (
    select player_id from public.om_daily_scores where season = p_season group by player_id) z;
  select count(*) + 1 into v_rank from (
    select player_id, sum(points) sp from public.om_daily_scores where season = p_season group by player_id) q
   where q.sp > v_pts;
  return jsonb_build_object('points', v_pts, 'tier', public.om_tier(v_pts),
                            'rank', case when v_pts > 0 then v_rank else null end, 'total', v_total);
end;
$$;

-- Store the player's equipped profile frame (shown on their leaderboard rows).
create or replace function public.om_set_frame(p_player_id text, p_frame text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.om_profiles(player_id, frame, updated_at)
  values (p_player_id, p_frame, now())
  on conflict (player_id) do update set frame = excluded.frame, updated_at = now();
end;
$$;

-- ── Grants: anon may only EXECUTE the RPCs (no direct table access) ─────────
grant execute on function
  public.om_daily_start(text, text),
  public.om_daily_submit(text, text, text, text, jsonb, int, uuid),
  public.om_daily_leaderboard(text, int),
  public.om_daily_friends(text, text[]),
  public.om_daily_my_rank(text, text),
  public.om_season_leaderboard(text, int),
  public.om_my_season(text, text),
  public.om_set_frame(text, text)
to anon, authenticated;

-- Quick self-test (optional): re-derive a couple of known days. The 'code'
-- arrays below should match what the game shows for those dates.
--   select public.om_daily_info('2026-06-13');  -- expect code ["purple","teal","purple","pink"]
--   select public.om_daily_info('2026-06-14');  -- expect code ["red","red","orange","yellow","yellow","green"]


-- ════════════════════════════════════════════════════════════════════════
--  PvP SKILL LADDER (Elo)  —  added in phase 2
--  Ratings update only when BOTH players' reports of a match agree
--  (corroboration), so one player can't unilaterally fake a win against a
--  real opponent. Seasonal ('YYYY-MM'), everyone starts at 1000.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.om_ladder (
  player_id    text not null,
  season       text not null,
  elo          int  not null default 1000,
  wins         int  not null default 0,
  losses       int  not null default 0,
  draws        int  not null default 0,
  display_name text not null default 'Player',
  avatar_url   text,
  updated_at   timestamptz not null default now(),
  primary key (player_id, season)
);
create index if not exists om_ladder_rank on public.om_ladder(season, elo desc);

create table if not exists public.om_ladder_reports (
  match_id    text not null,
  reporter_id text not null,
  opponent_id text not null,
  result      text not null,            -- 'win' | 'loss' | 'draw'
  display_name text,
  avatar_url  text,
  season      text not null,
  created_at  timestamptz not null default now(),
  primary key (match_id, reporter_id)
);

-- Resolution lock: one row per match guarantees Elo is applied exactly once.
create table if not exists public.om_ladder_matches (
  match_id   text primary key,
  season     text not null,
  result     text not null,             -- 'win' | 'draw' | 'disputed'
  winner_id  text,
  created_at timestamptz not null default now()
);

alter table public.om_ladder         enable row level security;
alter table public.om_ladder_reports enable row level security;
alter table public.om_ladder_matches enable row level security;

create or replace function public.om_elo_tier(p_elo int) returns text
  language sql immutable as $$
  select case
    when p_elo >= 1800 then 'OrbMaster'
    when p_elo >= 1600 then 'MindBreaker'
    when p_elo >= 1400 then 'Savant'
    when p_elo >= 1200 then 'Adept'
    when p_elo >= 1050 then 'Cipher'
    else 'Novice' end;
$$;

-- Report a finished PvP match. Returns status: 'pending' (awaiting opponent),
-- 'resolved' (with new elo + delta), or 'disputed' (reports disagreed).
create or replace function public.om_ladder_report(
  p_match_id text, p_reporter_id text, p_opponent_id text, p_result text,
  p_display_name text, p_avatar_url text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_season text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_opp text; v_winner text; v_inserted int;
  ra int; rb int; ea float; eb float; sa float; sb float; v_k int := 32; na int; nb int;
begin
  if p_reporter_id is null or p_opponent_id is null or p_reporter_id = p_opponent_id then
    return jsonb_build_object('ok', false, 'error', 'bad_players');
  end if;
  if p_result not in ('win','loss','draw') then
    return jsonb_build_object('ok', false, 'error', 'bad_result');
  end if;

  insert into public.om_ladder_reports(match_id, reporter_id, opponent_id, result, display_name, avatar_url, season)
  values (p_match_id, p_reporter_id, p_opponent_id, p_result, coalesce(nullif(p_display_name,''),'Player'), p_avatar_url, v_season)
  on conflict (match_id, reporter_id) do nothing;

  insert into public.om_ladder(player_id, season, display_name, avatar_url)
  values (p_reporter_id, v_season, coalesce(nullif(p_display_name,''),'Player'), p_avatar_url)
  on conflict (player_id, season) do update set display_name = excluded.display_name, avatar_url = excluded.avatar_url;

  select result into v_opp from public.om_ladder_reports
   where match_id = p_match_id and reporter_id = p_opponent_id and opponent_id = p_reporter_id;
  if v_opp is null then
    return jsonb_build_object('ok', true, 'status', 'pending');
  end if;

  if    (p_result='win'  and v_opp='loss') then v_winner := p_reporter_id;
  elsif (p_result='loss' and v_opp='win')  then v_winner := p_opponent_id;
  elsif (p_result='draw' and v_opp='draw') then v_winner := null;
  else
    insert into public.om_ladder_matches(match_id, season, result, winner_id)
    values (p_match_id, v_season, 'disputed', null) on conflict (match_id) do nothing;
    return jsonb_build_object('ok', true, 'status', 'disputed');
  end if;

  insert into public.om_ladder_matches(match_id, season, result, winner_id)
  values (p_match_id, v_season, case when v_winner is null then 'draw' else 'win' end, v_winner)
  on conflict (match_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'status', 'resolved');  -- already applied by the other side
  end if;

  insert into public.om_ladder(player_id, season) values (p_opponent_id, v_season) on conflict do nothing;
  select elo into ra from public.om_ladder where player_id = p_reporter_id and season = v_season;
  select elo into rb from public.om_ladder where player_id = p_opponent_id and season = v_season;
  ra := coalesce(ra, 1000); rb := coalesce(rb, 1000);
  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  eb := 1.0 - ea;
  if    v_winner is null            then sa := 0.5; sb := 0.5;
  elsif v_winner = p_reporter_id    then sa := 1;   sb := 0;
  else                                   sa := 0;   sb := 1; end if;
  na := round(ra + v_k * (sa - ea));
  nb := round(rb + v_k * (sb - eb));

  update public.om_ladder set elo = na,
      wins   = wins   + (case when v_winner = p_reporter_id then 1 else 0 end),
      losses = losses + (case when v_winner is not null and v_winner <> p_reporter_id then 1 else 0 end),
      draws  = draws  + (case when v_winner is null then 1 else 0 end),
      updated_at = now()
   where player_id = p_reporter_id and season = v_season;
  update public.om_ladder set elo = nb,
      wins   = wins   + (case when v_winner = p_opponent_id then 1 else 0 end),
      losses = losses + (case when v_winner is not null and v_winner <> p_opponent_id then 1 else 0 end),
      draws  = draws  + (case when v_winner is null then 1 else 0 end),
      updated_at = now()
   where player_id = p_opponent_id and season = v_season;

  return jsonb_build_object('ok', true, 'status', 'resolved', 'elo', na, 'delta', na - ra,
    'result', case when v_winner is null then 'draw' when v_winner = p_reporter_id then 'win' else 'loss' end);
end;
$$;

drop function if exists public.om_ladder_leaderboard(text, int);
create or replace function public.om_ladder_leaderboard(p_season text, p_limit int default 100)
  returns table(rank bigint, player_id text, display_name text, avatar_url text, elo int, wins int, losses int, draws int, tier text, frame text)
  language sql security definer set search_path = public stable as $$
  select rank() over (order by l.elo desc), l.player_id, l.display_name, l.avatar_url, l.elo, l.wins, l.losses, l.draws, public.om_elo_tier(l.elo), p.frame
  from public.om_ladder l left join public.om_profiles p on p.player_id = l.player_id
  where l.season = p_season
  order by l.elo desc limit greatest(1, least(p_limit, 500));
$$;

drop function if exists public.om_ladder_friends(text, text[]);
create or replace function public.om_ladder_friends(p_season text, p_ids text[])
  returns table(rank bigint, player_id text, display_name text, avatar_url text, elo int, wins int, losses int, draws int, tier text, frame text)
  language sql security definer set search_path = public stable as $$
  select * from (
    select rank() over (order by l.elo desc) rank, l.player_id, l.display_name, l.avatar_url, l.elo, l.wins, l.losses, l.draws, public.om_elo_tier(l.elo) tier, p.frame
    from public.om_ladder l left join public.om_profiles p on p.player_id = l.player_id
    where l.season = p_season
  ) q
  where q.player_id = any(p_ids)
  order by q.rank limit 200;
$$;

create or replace function public.om_my_ladder(p_season text, p_player_id text)
  returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_elo int; v_w int; v_l int; v_d int; v_rank int; v_total int;
begin
  select elo, wins, losses, draws into v_elo, v_w, v_l, v_d
    from public.om_ladder where season = p_season and player_id = p_player_id;
  select count(*) into v_total from public.om_ladder where season = p_season;
  if v_elo is null then
    return jsonb_build_object('ranked', false, 'total', v_total, 'elo', 1000, 'tier', public.om_elo_tier(1000));
  end if;
  select count(*) + 1 into v_rank from public.om_ladder where season = p_season and elo > v_elo;
  return jsonb_build_object('ranked', true, 'elo', v_elo, 'tier', public.om_elo_tier(v_elo),
    'wins', v_w, 'losses', v_l, 'draws', v_d, 'rank', v_rank, 'total', v_total);
end;
$$;

grant execute on function
  public.om_ladder_report(text, text, text, text, text, text),
  public.om_ladder_leaderboard(text, int),
  public.om_ladder_friends(text, text[]),
  public.om_my_ladder(text, text),
  public.om_elo_tier(int)
to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
--  GAUNTLET LEADERBOARD  (endless-run best depth — honor-system score)
--  Note: the run happens client-side, so depth is self-reported. Acceptable
--  for an arcade-style board; harden with server-authoritative play later.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.om_gauntlet (
  player_id    text primary key,
  display_name text not null default 'Player',
  avatar_url   text,
  best_depth   int  not null default 0,
  best_turns   int  not null default 0,
  updated_at   timestamptz not null default now()
);
alter table public.om_gauntlet enable row level security;

-- Submit a run; keeps the player's best (higher depth, then fewer total turns).
create or replace function public.om_gauntlet_submit(
  p_player_id text, p_display_name text, p_avatar_url text, p_depth int, p_turns int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_best int; v_rank int; v_total int;
begin
  if p_player_id is null or p_player_id = '' then return jsonb_build_object('ok', false); end if;
  insert into public.om_gauntlet(player_id, display_name, avatar_url, best_depth, best_turns)
  values (p_player_id, coalesce(nullif(p_display_name,''),'Player'), p_avatar_url, greatest(0,p_depth), greatest(0,p_turns))
  on conflict (player_id) do update set
    best_turns = case when excluded.best_depth > om_gauntlet.best_depth then excluded.best_turns
                      when excluded.best_depth = om_gauntlet.best_depth then least(om_gauntlet.best_turns, excluded.best_turns)
                      else om_gauntlet.best_turns end,
    best_depth = greatest(om_gauntlet.best_depth, excluded.best_depth),
    display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = now();
  select best_depth into v_best from public.om_gauntlet where player_id = p_player_id;
  select count(*) + 1 into v_rank
    from public.om_gauntlet o, (select g.best_depth d, g.best_turns t from public.om_gauntlet g where g.player_id = p_player_id) me
   where o.best_depth > me.d or (o.best_depth = me.d and o.best_turns < me.t);
  select count(*) into v_total from public.om_gauntlet;
  return jsonb_build_object('ok', true, 'best_depth', v_best, 'rank', v_rank, 'total', v_total);
end;
$$;

create or replace function public.om_gauntlet_leaderboard(p_limit int default 100)
  returns table(rank bigint, player_id text, display_name text, avatar_url text, depth int, turns int, frame text)
  language sql security definer set search_path = public stable as $$
  select rank() over (order by g.best_depth desc, g.best_turns asc), g.player_id, g.display_name, g.avatar_url, g.best_depth, g.best_turns, p.frame
  from public.om_gauntlet g left join public.om_profiles p on p.player_id = g.player_id
  order by g.best_depth desc, g.best_turns asc limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.om_gauntlet_friends(p_ids text[])
  returns table(rank bigint, player_id text, display_name text, avatar_url text, depth int, turns int, frame text)
  language sql security definer set search_path = public stable as $$
  select * from (
    select rank() over (order by g.best_depth desc, g.best_turns asc) rank, g.player_id, g.display_name, g.avatar_url, g.best_depth, g.best_turns, p.frame
    from public.om_gauntlet g left join public.om_profiles p on p.player_id = g.player_id
  ) q where q.player_id = any(p_ids) order by q.rank limit 200;
$$;

create or replace function public.om_my_gauntlet(p_player_id text)
  returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_d int; v_t int; v_rank int; v_total int;
begin
  select best_depth, best_turns into v_d, v_t from public.om_gauntlet where player_id = p_player_id;
  select count(*) into v_total from public.om_gauntlet;
  if v_d is null then return jsonb_build_object('ranked', false, 'depth', 0, 'total', v_total); end if;
  select count(*) + 1 into v_rank from public.om_gauntlet o where o.best_depth > v_d or (o.best_depth = v_d and o.best_turns < v_t);
  return jsonb_build_object('ranked', true, 'depth', v_d, 'turns', v_t, 'rank', v_rank, 'total', v_total);
end;
$$;

grant execute on function
  public.om_gauntlet_submit(text, text, text, int, int),
  public.om_gauntlet_leaderboard(int),
  public.om_gauntlet_friends(text[]),
  public.om_my_gauntlet(text)
to anon, authenticated;
