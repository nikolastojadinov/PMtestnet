-- backend/src/lib/models/seedsChannels.sql
-- Seed channels used for efficient channel-crawl discovery

CREATE TABLE IF NOT EXISTS public.seeds_channels (
  channel_id TEXT PRIMARY KEY,
  lang TEXT DEFAULT 'en',
  region_score FLOAT DEFAULT 0,
  added_on TIMESTAMPTZ DEFAULT NOW()
);

-- Optional manual seeds can be inserted here during migrations, e.g.:
-- INSERT INTO public.seeds_channels (channel_id, lang, region_score)
-- VALUES ('UC_x5XG1OV2P6uZZ5FSM9Ttw', 'en', 1.0)
-- ON CONFLICT (channel_id) DO NOTHING;
