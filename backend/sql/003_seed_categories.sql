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

-- Add remaining groups to reach total of 140 (9 groups × 10)

-- Classical (10)
insert into public.categories(key, group_key, label) values
  ('baroque','Classical','Baroque'),
  ('classical_era','Classical','Classical Era'),
  ('romantic','Classical','Romantic'),
  ('modern_classical','Classical','Modern Classical'),
  ('minimalism','Classical','Minimalism'),
  ('piano_solo','Classical','Piano Solo'),
  ('string_quartet','Classical','String Quartet'),
  ('symphony','Classical','Symphony'),
  ('opera','Classical','Opera'),
  ('choral','Classical','Choral')
on conflict (key) do nothing;

-- World (10)
insert into public.categories(key, group_key, label) values
  ('latin','World','Latin'),
  ('afrobeat','World','Afrobeat'),
  ('afro_pop','World','Afro Pop'),
  ('celtic','World','Celtic'),
  ('balkan','World','Balkan'),
  ('klezmer','World','Klezmer'),
  ('flamenco','World','Flamenco'),
  ('bollywood','World','Bollywood'),
  ('mandopop','World','Mandopop'),
  ('cantopop','World','Cantopop')
on conflict (key) do nothing;

-- Chill (10)
insert into public.categories(key, group_key, label) values
  ('chillhop','Chill','Chillhop'),
  ('lofi_beats','Chill','Lo‑Fi Beats'),
  ('ambient','Chill','Ambient'),
  ('downtempo','Chill','Downtempo'),
  ('chillout','Chill','Chillout'),
  ('bedroom_pop','Chill','Bedroom Pop'),
  ('neo_soul_chill','Chill','Neo‑Soul Chill'),
  ('coffeehouse','Chill','Coffeehouse'),
  ('study_music','Chill','Study Music'),
  ('meditation','Chill','Meditation')
on conflict (key) do nothing;

-- Soundtracks (10)
insert into public.categories(key, group_key, label) values
  ('film_scores','Soundtracks','Film Scores'),
  ('tv_scores','Soundtracks','TV Scores'),
  ('game_soundtracks','Soundtracks','Game Soundtracks'),
  ('anime_ost','Soundtracks','Anime OST'),
  ('orchestral_scores','Soundtracks','Orchestral Scores'),
  ('epic_music','Soundtracks','Epic Music'),
  ('trailer_music','Soundtracks','Trailer Music'),
  ('documentary_scores','Soundtracks','Documentary Scores'),
  ('fantasy_scores','Soundtracks','Fantasy Scores'),
  ('sci_fi_scores','Soundtracks','Sci‑Fi Scores')
on conflict (key) do nothing;

-- Country (10)
insert into public.categories(key, group_key, label) values
  ('classic_country','Country','Classic Country'),
  ('modern_country','Country','Modern Country'),
  ('alt_country','Country','Alternative Country'),
  ('bluegrass','Country','Bluegrass'),
  ('americana','Country','Americana'),
  ('country_pop','Country','Country Pop'),
  ('country_rock','Country','Country Rock'),
  ('outlaw_country','Country','Outlaw Country'),
  ('honky_tonk','Country','Honky Tonk'),
  ('country_ballads','Country','Country Ballads')
on conflict (key) do nothing;

-- Reggae (10)
insert into public.categories(key, group_key, label) values
  ('roots_reggae','Reggae','Roots Reggae'),
  ('dancehall','Reggae','Dancehall'),
  ('dub','Reggae','Dub'),
  ('ska','Reggae','Ska'),
  ('rocksteady','Reggae','Rocksteady'),
  ('lovers_rock','Reggae','Lovers Rock'),
  ('ragga','Reggae','Ragga'),
  ('reggae_fusion','Reggae','Reggae Fusion'),
  ('conscious_reggae','Reggae','Conscious Reggae'),
  ('modern_reggae','Reggae','Modern Reggae')
on conflict (key) do nothing;

-- Soul (10)
insert into public.categories(key, group_key, label) values
  ('motown','Soul','Motown'),
  ('neo_soul','Soul','Neo‑Soul'),
  ('funk','Soul','Funk'),
  ('disco','Soul','Disco'),
  ('quiet_storm','Soul','Quiet Storm'),
  ('philly_soul','Soul','Philly Soul'),
  ('northern_soul','Soul','Northern Soul'),
  ('blue_eyed_soul','Soul','Blue‑Eyed Soul'),
  ('groove','Soul','Groove'),
  ('soul_ballads','Soul','Soul Ballads')
on conflict (key) do nothing;

-- Regional (10)
insert into public.categories(key, group_key, label) values
  ('brazilian','Regional','Brazilian'),
  ('argentinian','Regional','Argentinian'),
  ('mexican','Regional','Mexican'),
  ('turkish','Regional','Turkish'),
  ('arabic','Regional','Arabic'),
  ('greek','Regional','Greek'),
  ('serbian','Regional','Serbian'),
  ('hungarian','Regional','Hungarian'),
  ('japanese','Regional','Japanese'),
  ('korean','Regional','Korean')
on conflict (key) do nothing;

-- Experimental (10)
insert into public.categories(key, group_key, label) values
  ('avant_garde','Experimental','Avant‑Garde'),
  ('noise','Experimental','Noise'),
  ('glitch','Experimental','Glitch'),
  ('idm','Experimental','IDM'),
  ('electroacoustic','Experimental','Electroacoustic'),
  ('drone','Experimental','Drone'),
  ('field_recordings','Experimental','Field Recordings'),
  ('modular','Experimental','Modular'),
  ('post_rock','Experimental','Post‑Rock'),
  ('leftfield','Experimental','Leftfield')
on conflict (key) do nothing;
