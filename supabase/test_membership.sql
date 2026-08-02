-- Test-group membership helpers (not part of the migration chain).
--
-- The resolution trigger (0003) only fires once every member has voted on
-- every suggestion, so a round will not resolve while the group contains
-- accounts nobody is driving. Trim the group to the accounts you are actually
-- testing with, then add the real people back afterwards.

-- Accounts parked during testing -- re-add with the block at the bottom.
--   c2f1d828-026c-40e2-abc8-98543a442bb1  anandj82@gmail.com      Anand
--   b9632b54-a930-4fe3-a43d-7bbc0804b44f  raseenm3694@gmail.com   Raseen
--   12faacd1-b234-4fe8-abcb-70a118c97f59  testuser2supa@mailinator.com  Test User 3

-- Trim to the two accounts that have been voting.
delete from group_members
where group_id = (select id from groups where name = 'Weekend Trip')
  and user_id in (
    'c2f1d828-026c-40e2-abc8-98543a442bb1',  -- Anand
    'b9632b54-a930-4fe3-a43d-7bbc0804b44f',  -- Raseen
    '12faacd1-b234-4fe8-abcb-70a118c97f59'   -- Test User 3
  );

-- Put them back once testing is done.
-- insert into group_members (group_id, user_id)
-- select (select id from groups where name = 'Weekend Trip'), u
-- from unnest(array[
--   'c2f1d828-026c-40e2-abc8-98543a442bb1'::uuid,
--   'b9632b54-a930-4fe3-a43d-7bbc0804b44f'::uuid,
--   '12faacd1-b234-4fe8-abcb-70a118c97f59'::uuid
-- ]) as u
-- on conflict do nothing;
