-- Advanced pitching stats for GameChanger standard + advanced screenshots

alter table extracted_pitching_stats
add column if not exists batters_faced integer,
add column if not exists total_pitches integer,
add column if not exists strikes integer,
add column if not exists first_pitch_strike_pct numeric,
add column if not exists k_bb_ratio numeric,
add column if not exists walks_per_inning numeric,
add column if not exists pitches_per_inning numeric,
add column if not exists pitches_per_batter_faced numeric,
add column if not exists one_two_three_innings integer,
add column if not exists leadoff_outs integer,
add column if not exists swing_miss_pct numeric,
add column if not exists baa numeric,
add column if not exists babip numeric,
add column if not exists fip numeric;

-- Backfill total_pitches from legacy pitches column
update extracted_pitching_stats
set total_pitches = pitches
where total_pitches is null and pitches is not null;
