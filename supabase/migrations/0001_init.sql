create extension if not exists pgcrypto;

-- app_users mirrors auth.users; never store passwords here
create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at  timestamptz not null default now()
);

create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references app_users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table group_members (
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  blurb       text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

create table suggestion_rounds (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  opened_at   timestamptz not null default now(),
  closes_at   timestamptz not null,
  resolved_at timestamptz,
  winner_suggestion_id uuid,
  status      text not null default 'open'
              check (status in ('open','resolved','no_result','tie')),
  -- set only when status = 'tie' and the group has recorded their offline choice
  settled_suggestion_id uuid,
  settled_by  uuid references app_users(id) on delete set null,
  settled_at  timestamptz
);

create table suggestions (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references suggestion_rounds(id) on delete cascade,
  place_id    uuid not null references places(id) on delete restrict,
  added_by    uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (round_id, place_id)
);

create table votes (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  voter_id      uuid not null references app_users(id) on delete cascade,
  value         text not null check (value in ('yes','pass')),
  is_revealed   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (suggestion_id, voter_id)
);

alter table suggestion_rounds
  add constraint fk_winner foreign key (winner_suggestion_id)
  references suggestions(id) on delete set null;

alter table suggestion_rounds
  add constraint fk_settled foreign key (settled_suggestion_id)
  references suggestions(id) on delete set null;

-- a tie's recorded outcome is write-once: first record wins (D8)
create unique index one_settlement_per_round
  on suggestion_rounds(id) where settled_suggestion_id is not null;

create index on group_members(user_id);
create index on suggestions(round_id);
create index on votes(suggestion_id);
create index on suggestion_rounds(group_id, opened_at desc);
