-- Seed data for local testing (T7)
-- Replace the four UUIDs below with real auth.users ids.
-- Run: select id, email from auth.users; in the SQL editor to get them.
-- Member 1 is the group creator and must exist before running this script.

do $$
declare
  member1 uuid := 'REPLACE_WITH_YOUR_USER_ID';
  member2 uuid := 'REPLACE_WITH_MEMBER2_USER_ID';
  member3 uuid := 'REPLACE_WITH_MEMBER3_USER_ID';
  member4 uuid := 'REPLACE_WITH_MEMBER4_USER_ID';

  place_munnar    uuid;
  place_srinagar  uuid;
  place_tokyo     uuid;
  place_chennai   uuid;

  group_id  uuid;
  round_id  uuid;
begin

  -- Places
  insert into places (name, blurb, lat, lng) values
    ('Munnar, Kerala',     'Rolling tea estates in the Western Ghats', 10.0889, 77.0595),
    ('Srinagar, Kashmir',  'Dal Lake and the Himalayan valley',         34.0837, 74.7973),
    ('Tokyo, Japan',       'Neon and tradition in equal measure',       35.6762, 139.6503),
    ('Chennai, Tamil Nadu','Marina Beach and Chettinad cuisine',        13.0827, 80.2707)
  returning id into place_munnar;

  -- fetch the other place ids
  select id into place_munnar   from places where name = 'Munnar, Kerala';
  select id into place_srinagar from places where name = 'Srinagar, Kashmir';
  select id into place_tokyo    from places where name = 'Tokyo, Japan';
  select id into place_chennai  from places where name = 'Chennai, Tamil Nadu';

  -- Ensure app_users rows exist for all four members
  insert into app_users (id, display_name) values
    (member1, 'Member 1'),
    (member2, 'Member 2'),
    (member3, 'Member 3'),
    (member4, 'Member 4')
  on conflict (id) do nothing;

  -- Group
  insert into groups (name, created_by)
    values ('Weekend Trip', member1)
    returning id into group_id;

  -- Members
  insert into group_members (group_id, user_id) values
    (group_id, member1),
    (group_id, member2),
    (group_id, member3),
    (group_id, member4);

  -- Round (closes 7 days from now)
  insert into suggestion_rounds (group_id, closes_at)
    values (group_id, now() + interval '7 days')
    returning id into round_id;

  -- Suggestions
  insert into suggestions (round_id, place_id, added_by) values
    (round_id, place_munnar,   member1),
    (round_id, place_srinagar, member1),
    (round_id, place_tokyo,    member1),
    (round_id, place_chennai,  member1);

end $$;
