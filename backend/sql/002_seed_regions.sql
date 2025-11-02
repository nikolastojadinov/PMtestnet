-- Ensure table exists (safe on re-run)
create table if not exists public.regions (
  code text primary key,
  label text
);

-- Seed YouTube region codes (superset; adjust to official supported list as needed)
insert into public.regions(code, label) values
  ('US','United States'),('CA','Canada'),('MX','Mexico'),('BR','Brazil'),('AR','Argentina'),('CL','Chile'),('CO','Colombia'),('PE','Peru'),('VE','Venezuela'),('DO','Dominican Republic'),('EC','Ecuador'),('UY','Uruguay'),
  ('GB','United Kingdom'),('FR','France'),('DE','Germany'),('ES','Spain'),('IT','Italy'),('NL','Netherlands'),('PL','Poland'),('SE','Sweden'),('NO','Norway'),('FI','Finland'),('PT','Portugal'),('UA','Ukraine'),('CZ','Czechia'),('HU','Hungary'),('RO','Romania'),('GR','Greece'),('RS','Serbia'),('HR','Croatia'),('BG','Bulgaria'),('CH','Switzerland'),('BE','Belgium'),('DK','Denmark'),('SK','Slovakia'),
  ('TR','Turkey'),('SA','Saudi Arabia'),('AE','United Arab Emirates'),('EG','Egypt'),('NG','Nigeria'),('KE','Kenya'),('ZA','South Africa'),('DZ','Algeria'),('MA','Morocco'),('TN','Tunisia'),('GH','Ghana'),('UG','Uganda'),('TZ','Tanzania'),('ET','Ethiopia'),
  ('IN','India'),('PK','Pakistan'),('BD','Bangladesh'),('VN','Vietnam'),('PH','Philippines'),('TH','Thailand'),('MY','Malaysia'),('ID','Indonesia'),('KR','South Korea'),('JP','Japan'),('HK','Hong Kong'),('SG','Singapore'),('TW','Taiwan'),('NP','Nepal'),('LK','Sri Lanka'),('KH','Cambodia'),('MM','Myanmar'),('LA','Laos'),('CN','China'),
  ('AU','Australia'),('NZ','New Zealand'),('FJ','Fiji'),('PG','Papua New Guinea'),('SB','Solomon Islands'),('TO','Tonga')
on conflict (code) do nothing;
