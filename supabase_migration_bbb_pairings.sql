-- Run this in Supabase SQL Editor to add the bbb_pairings column.
-- This stores the frozen BBB pairings at the time an event is marked complete.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS bbb_pairings JSONB;
