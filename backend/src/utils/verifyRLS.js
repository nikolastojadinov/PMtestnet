// backend/src/utils/verifyRLS.js
// Best-effort RLS diagnostics for playlists_raw using the service-role client.
// Note: PostgREST does not expose pg_class/pg_policies, so we infer access by
// attempting a head SELECT and a write probe that we immediately delete.

export async function verifyPlaylistsRawRLS(supabaseClient) {
  const out = {
    serviceRoleEnv: !!process.env.SUPABASE_SERVICE_ROLE,
    readOk: null,
    insertOk: null,
    details: null,
  };

  try {
    // Head select to test SELECT privilege (non-invasive)
    const sel = await supabaseClient
      .from('playlists_raw')
      .select('id', { count: 'exact', head: true });
    out.readOk = !sel.error;
  } catch (e) {
    out.readOk = false;
  }

  // Insert probe (creates one row then deletes it). Only do this once per process.
  if (!globalThis.__pm_rlsInsertProbed) {
    try {
      const probeId = `__rls_probe__${Date.now()}`;
      const probe = {
        external_id: probeId,
        title: 'rls-probe',
        description: null,
        channel_id: null,
        channel_title: null,
        region: 'GLOBAL',
        category: 'probe',
        thumbnail_url: null,
        fetched_on: new Date().toISOString(),
        validated: false,
        cycle_mode: 'FETCH',
      };
      const ins = await supabaseClient.from('playlists_raw').insert([probe]).select('external_id').single();
      out.insertOk = !ins.error;
      // Cleanup if insert succeeded
      if (!ins.error) {
        await supabaseClient.from('playlists_raw').delete().eq('external_id', probeId);
      } else {
        out.details = ins.error?.message || String(ins.error);
      }
    } catch (e) {
      out.insertOk = false;
      out.details = e?.message || String(e);
    }
    globalThis.__pm_rlsInsertProbed = true;
  }

  const serviceAccess = out.insertOk === true ? 'allowed' : (out.insertOk === false ? 'blocked' : 'unknown');
  console.log(`[rls-check] Service role present: ${out.serviceRoleEnv}`);
  console.log(`[rls-check] Read privilege (head select): ${out.readOk === null ? 'unknown' : out.readOk}`);
  console.log(`[rls-check] Insert privilege (probe): ${out.insertOk === null ? 'unknown' : out.insertOk}`);
  console.log(`[rls-check] Service role access: ${serviceAccess}${out.details ? ` — ${out.details}` : ''}`);

  return out;
}

export default { verifyPlaylistsRawRLS };
