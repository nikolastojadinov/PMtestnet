-- Cache of discovered playlist IDs
CREATE TABLE IF NOT EXISTS discovered_playlists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id   text UNIQUE NOT NULL,
  region        text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

-- Discovery progress and budgets
CREATE TABLE IF NOT EXISTS discovery_state (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_region        text NOT NULL DEFAULT 'IN',
  day_in_cycle       int  NOT NULL DEFAULT 1,
  tick_date          date NOT NULL DEFAULT CURRENT_DATE,
  units_used_today   int  NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
