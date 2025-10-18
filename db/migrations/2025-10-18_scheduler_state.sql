-- Create scheduler_state to persist 31-day cycle state
CREATE TABLE IF NOT EXISTS scheduler_state (
  id SERIAL PRIMARY KEY,
  mode TEXT CHECK (mode IN ('FETCH','REFRESH')) NOT NULL,
  day_in_cycle INT NOT NULL,
  last_tick TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure at least one row exists with default state
INSERT INTO scheduler_state (mode, day_in_cycle)
SELECT 'FETCH', 1
WHERE NOT EXISTS (SELECT 1 FROM scheduler_state);
