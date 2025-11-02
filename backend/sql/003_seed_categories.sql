-- Seed 140 categories (groups with 10 items). This is a starter; extend to full 140.
-- Use keys as stable identifiers.

insert into public.categories(key, group_key, label) values
  -- Pop (10)
  ('pop_classics','Pop','Pop Classics'),
  ('pop_hits','Pop','Pop Hits'),
  ('kpop','Pop','K‑Pop'),
  ('synthpop','Pop','Synth‑Pop'),
  ('indie_pop','Pop','Indie Pop'),
  ('dance_pop','Pop','Dance Pop'),
  ('electropop','Pop','Electro‑Pop'),
  ('teen_pop','Pop','Teen Pop'),
  ('alt_pop','Pop','Alt Pop'),
  ('pop_ballads','Pop','Pop Ballads'),

  -- Rock (10)
  ('classic_rock','Rock','Classic Rock'),
  ('alt_rock','Rock','Alternative Rock'),
  ('hard_rock','Rock','Hard Rock'),
  ('punk_rock','Rock','Punk Rock'),
  ('indie_rock','Rock','Indie Rock'),
  ('garage_rock','Rock','Garage Rock'),
  ('psychedelic_rock','Rock','Psychedelic Rock'),
  ('grunge','Rock','Grunge'),
  ('soft_rock','Rock','Soft Rock'),
  ('progressive_rock','Rock','Progressive Rock'),

  -- Hip Hop (10)
  ('boom_bap','HipHop','Boom Bap'),
  ('trap','HipHop','Trap'),
  ('lofi_hiphop','HipHop','Lo‑Fi Hip‑Hop'),
  ('underground_rap','HipHop','Underground Rap'),
  ('east_coast','HipHop','East Coast'),
  ('west_coast','HipHop','West Coast'),
  ('drill','HipHop','Drill'),
  ('conscious_rap','HipHop','Conscious Rap'),
  ('old_school_rap','HipHop','Old School Rap'),
  ('rnb_hiphop','HipHop','R&B / Hip‑Hop'),

  -- EDM (10)
  ('house','EDM','House'),
  ('techno','EDM','Techno'),
  ('trance','EDM','Trance'),
  ('drum_and_bass','EDM','Drum & Bass'),
  ('dubstep','EDM','Dubstep'),
  ('future_bass','EDM','Future Bass'),
  ('electro','EDM','Electro'),
  ('progressive_house','EDM','Progressive House'),
  ('deep_house','EDM','Deep House'),
  ('chillstep','EDM','Chillstep'),

  -- Jazz (10)
  ('bebop','Jazz','Bebop'),
  ('swing','Jazz','Swing'),
  ('cool_jazz','Jazz','Cool Jazz'),
  ('smooth_jazz','Jazz','Smooth Jazz'),
  ('fusion','Jazz','Fusion'),
  ('latin_jazz','Jazz','Latin Jazz'),
  ('free_jazz','Jazz','Free Jazz'),
  ('vocal_jazz','Jazz','Vocal Jazz'),
  ('gypsy_jazz','Jazz','Gypsy Jazz'),
  ('contemporary_jazz','Jazz','Contemporary Jazz')

on conflict (key) do nothing;

-- TODO: Add Classical, World, Chill, Soundtracks, Country, Reggae, Soul, Regional, Experimental, etc. to reach 140.
