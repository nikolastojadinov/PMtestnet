// backend/src/jobs/fetchPlaylists.js
// ✅ FULL REWRITE — kompatibilno sa postojećom Supabase šemom
// - NEMA onConflict; radimo client-side dedupe po external_id
// - Ubacivanje u chunk-ovima da ne guši Supabase payload
// - Cilj: do ~6000 playlisti dnevno (zavisi koliko vrati youtube.js)
// - Koristi 70-region pool iz utils.js i bira današnji set regiona

import supabase from '../lib/supabase.js';
import { pickTodayRegions, sleep } from '../lib/utils.js';
import { fetchRegionPlaylists } from '../lib/youtube.js';

// Koliko regiona danas obrađujemo (podešavanje po potrebi)
// Napomena: youtube.js trenutno vraća ~25 po regionu.
// Ako koristiš 40 regiona → ~1000; za 6000 treba proširen fetch u youtube.js.
const REGIONS_PER_DAY = 40;

// Hard limit dnevnog ubacivanja (bezbednosna zaštita)
const DAILY_PLAYLIST_CAP = 6000;

// Chunk veličine za SELECT/INSERT
const SELECT_CHUNK = 900;   // .in() lista ID-jeva
const INSERT_CHUNK = 500;   // batch insert

function uniqueByExternalId(arr) {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const id = it?.external_id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

async function fetchExistingIds(allIds) {
  const existing = new Set();
  // Supabase .in() bolje radi u chunkovima
  for (let i = 0; i < allIds.length; i += SELECT_CHUNK) {
    const batch = allIds.slice(i, i + SELECT_CHUNK);
    const { data, error } = await supabase
      .from('playlists')
      .select('external_id')
      .in('external_id', batch);

    if (error) {
      console.error('[playlists] ⚠️ Failed to read existing IDs:', error.message);
      // u slučaju greške, ne prekidamo — radimo best-effort
      continue;
    }
    for (const row of data || []) {
      if (row?.external_id) existing.add(row.external_id);
    }
    // kratka pauza da izbegnemo ograničenja
    await sleep(80);
  }
  return existing;
}

async function insertInChunks(rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from('playlists').insert(chunk);
    if (error) {
      console.error('[playlists] ❌ Insert chunk failed:', error.message);
      // nastavljamo dalje — cilj je da ubacimo što više
    } else {
      inserted += chunk.length;
    }
    await sleep(100);
  }
  return inserted;
}

export async function runFetchPlaylists() {
  console.log('[playlists] 🚀 Starting YouTube playlist fetch job...');

  // 1) Izbor regiona za današnji dan (deterministički + “GLOBAL” osiguran u utils)
  const regions = pickTodayRegions(REGIONS_PER_DAY);
  console.log('[youtube] 🌍 Fetching playlists for regions:', regions.join(', '));

  // 2) Dohvat iz YouTube (preko youtube.js)
  //    Ova funkcija vraća objekte { id, snippet, region }
  const raw = await fetchRegionPlaylists(regions);

  // 3) Mapiranje u našu Supabase šemu (bez kolona kojih nema u bazi)
  const nowIso = new Date().toISOString();
  const mapped = (raw || [])
    .map((pl) => {
      const externalId = pl?.id || pl?.playlistId || pl?.snippet?.playlistId;
      if (!externalId) return null;

      return {
        external_id: String(externalId),
        title: pl?.snippet?.title ?? 'Untitled Playlist',
        description: pl?.snippet?.description ?? '',
        cover_url:
          pl?.snippet?.thumbnails?.maxres?.url ||
          pl?.snippet?.thumbnails?.high?.url ||
          pl?.snippet?.thumbnails?.medium?.url ||
          pl?.snippet?.thumbnails?.default?.url ||
          null,
        region: pl?.region || 'GLOBAL',
        category: 'music',
        is_public: true,
        created_at: nowIso, // ako već postoji, ovaj red se neće insertovati (skippovaćemo)
        fetched_on: nowIso,
      };
    })
    .filter(Boolean);

  if (!mapped.length) {
    console.log('[playlists] ⚠️ No playlists fetched from YouTube.');
    return;
  }

  // 4) Klijentska deduplikacija po external_id (pre upisa)
  const dedupClient = uniqueByExternalId(mapped);
  console.log(`[playlists] ✅ Deduplicated (client-side): ${dedupClient.length} playlists`);

  // 5) Poštuj dnevni limit (cap)
  const capped = dedupClient.slice(0, DAILY_PLAYLIST_CAP);

  // 6) Pročitaj koje ID-jeve već imamo u bazi i isključi ih iz inserta
  const allIds = capped.map((x) => x.external_id);
  const existing = await fetchExistingIds(allIds);
  const toInsert = capped.filter((x) => !existing.has(x.external_id));

  console.log(
    `[playlists] 📊 Existing in DB: ${existing.size} | New to insert: ${toInsert.length} (of ${capped.length} capped)`
  );

  if (!toInsert.length) {
    console.log('[playlists] ℹ️ Nothing to insert — DB already has these playlists.');
    return;
  }

  // 7) Ubaci u chunkovima (bez onConflict)
  const insertedCount = await insertInChunks(toInsert);
  console.log(`[playlists] ✅ ${insertedCount} playlists inserted into Supabase.`);
}
