create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_name') then
    create type platform_name as enum ('tiktok', 'instagram', 'youtube_shorts', 'twitch', 'reddit', 'x', 'facebook', 'pinterest');
  end if;
  if not exists (select 1 from pg_type where typname = 'asset_status') then
    create type asset_status as enum ('draft', 'approved', 'queued', 'posted', 'failed', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type approval_status as enum ('pending', 'approved', 'rejected', 'revision_requested');
  end if;
  if not exists (select 1 from pg_type where typname = 'voice_preset') then
    create type voice_preset as enum ('playful', 'drummer_girl', 'confident', 'flirty_safe', 'livestream_growth');
  end if;
  if not exists (select 1 from pg_type where typname = 'execution_mode') then
    create type execution_mode as enum ('direct', 'manual_handoff', 'source_only');
  end if;
  if not exists (select 1 from pg_type where typname = 'publish_job_status') then
    create type publish_job_status as enum ('queued', 'scheduled', 'processing', 'published', 'manual_action_required', 'failed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'approval_policy') then
    create type approval_policy as enum ('human_required', 'auto_post_approved_only');
  end if;
end $$;

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  brand_name text not null,
  timezone text not null default 'America/Chicago',
  default_voice_preset voice_preset not null default 'drummer_girl',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_memberships (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (creator_id, user_id)
);

create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  platform platform_name not null,
  account_label text not null,
  account_handle text,
  account_type text,
  status text not null default 'not_linked',
  publish_mode execution_mode not null default 'manual_handoff',
  scopes text[] not null default '{}'::text[],
  capabilities jsonb not null default '{}'::jsonb,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  source_type text not null,
  source_platform platform_name,
  source_url text,
  source_posted_at timestamptz,
  original_filename text not null,
  checksum_sha256 text,
  perceptual_fingerprint text,
  storage_bucket text,
  storage_path text,
  public_url text,
  thumbnail_url text,
  mime_type text not null,
  duration_seconds integer,
  width integer,
  height integer,
  title text not null,
  source_caption text,
  creator_notes text,
  campaign text,
  voice_preset voice_preset not null default 'drummer_girl',
  lifecycle_status asset_status not null default 'draft',
  approval_status approval_status not null default 'pending',
  approval_policy approval_policy not null default 'human_required',
  auto_post_approved boolean not null default false,
  scheduled_for timestamptz,
  duplicate_override boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_versions (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  version_kind text not null,
  platform platform_name,
  variant_label text not null,
  storage_path text,
  public_url text,
  width integer,
  height integer,
  duration_seconds integer,
  file_size_bytes bigint,
  transformation_status text not null default 'ready',
  transformation_notes text,
  created_at timestamptz not null default now()
);

create table if not exists captions (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  platform platform_name not null,
  voice_preset voice_preset not null,
  variant_name text not null,
  title_text text,
  caption_text text not null,
  call_to_action text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists hashtag_sets (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  platform platform_name not null,
  set_name text not null,
  hashtags text[] not null default '{}'::text[],
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists publishing_targets (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  platform platform_name not null,
  execution_mode execution_mode not null,
  connector_status text not null default 'prepared',
  selected_caption_id uuid references captions(id) on delete set null,
  selected_hashtag_set_id uuid references hashtag_sets(id) on delete set null,
  scheduled_for timestamptz,
  cooldown_until timestamptz,
  allow_repost boolean not null default false,
  manual_instructions text,
  status text not null default 'pending_approval',
  external_post_id text,
  external_url text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists publish_jobs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  publishing_target_id uuid not null references publishing_targets(id) on delete cascade,
  job_type text not null default 'publish',
  status publish_job_status not null default 'queued',
  run_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  worker_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists publish_attempts (
  id uuid primary key default gen_random_uuid(),
  publish_job_id uuid not null references publish_jobs(id) on delete cascade,
  publishing_target_id uuid not null references publishing_targets(id) on delete cascade,
  status text not null,
  http_status integer,
  response_excerpt text,
  manual_handoff_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists approval_records (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  requested_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  decision approval_status not null default 'pending',
  decision_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  publishing_target_id uuid not null references publishing_targets(id) on delete cascade,
  metric_window_start timestamptz,
  metric_window_end timestamptz,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  watch_time_seconds numeric,
  ctr numeric,
  raw_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists media_tag_links (
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (media_asset_id, tag_id)
);

create table if not exists duplicate_checks (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  checksum_sha256 text,
  matched_media_asset_id uuid references media_assets(id) on delete set null,
  matched_target_platform platform_name,
  similarity_score numeric,
  result text not null,
  blocking boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_label text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  severity text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_creator_idx on media_assets(creator_id, created_at desc);
create index if not exists media_assets_status_idx on media_assets(lifecycle_status, approval_status);
create index if not exists media_assets_checksum_idx on media_assets(checksum_sha256);
create index if not exists publishing_targets_asset_idx on publishing_targets(media_asset_id, platform);
create index if not exists publish_jobs_due_idx on publish_jobs(status, run_at);
create index if not exists publish_attempts_job_idx on publish_attempts(publish_job_id, created_at desc);
create index if not exists approval_records_asset_idx on approval_records(media_asset_id, created_at desc);
create index if not exists analytics_snapshots_target_idx on analytics_snapshots(publishing_target_id, captured_at desc);
create index if not exists duplicate_checks_asset_idx on duplicate_checks(media_asset_id, created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id, created_at desc);

insert into creators (slug, display_name, brand_name, timezone, default_voice_preset)
values ('brooke-drums', 'Brooke', 'Brooke Drums', 'America/Chicago', 'drummer_girl')
on conflict (slug) do nothing;

insert into tags (slug, label, category)
values
  ('drum-cover', 'Drum Cover', 'content'),
  ('practice-clip', 'Practice Clip', 'content'),
  ('funny-moment', 'Funny Moment', 'content'),
  ('livestream-highlight', 'Livestream Highlight', 'content'),
  ('behind-the-scenes', 'Behind The Scenes', 'content'),
  ('thirst-trap-glam-lifestyle', 'Thirst Trap / Glam / Lifestyle', 'style'),
  ('music-influencer', 'Music Influencer', 'positioning'),
  ('beginner-journey', 'Beginner Journey', 'story'),
  ('viral-candidate', 'Viral Candidate', 'strategy')
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public)
values ('creator-media', 'creator-media', false)
on conflict (id) do nothing;

