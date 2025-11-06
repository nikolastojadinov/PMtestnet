BEGIN;
CREATE TABLE IF NOT EXISTS public.search_seeds (
  id BIGSERIAL PRIMARY KEY,
  day INT NOT NULL CHECK (day BETWEEN 1 AND 29),
  slot INT NOT NULL CHECK (slot BETWEEN 0 AND 19),
  pos INT NOT NULL CHECK (pos BETWEEN 0 AND 99),
  query TEXT NOT NULL UNIQUE,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_search_seeds_day_slot_pos ON public.search_seeds(day,slot,pos);
CREATE INDEX IF NOT EXISTS idx_search_seeds_day_slot ON public.search_seeds(day,slot);
CREATE INDEX IF NOT EXISTS idx_search_seeds_tag_region ON public.search_seeds((tags->>'region'));
CREATE INDEX IF NOT EXISTS idx_search_seeds_tag_lang ON public.search_seeds((tags->>'lang'));
CREATE INDEX IF NOT EXISTS idx_search_seeds_tag_category ON public.search_seeds((tags->>'category'));
COMMIT;
