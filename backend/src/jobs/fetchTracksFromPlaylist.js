// DEPRECATED: Do not use.
// This legacy job has been replaced by resume-aware implementation in
// backend/src/jobs/fetchTracksFromPlaylists.js which persists selection
// and progress via job_state and job_cursor.
//
// Intentionally throw on import or invocation to prevent accidental use.
throw new Error(
  '[deprecated] backend/src/jobs/fetchTracksFromPlaylist.js has been removed. Use fetchTracksFromPlaylists.js instead.'
);
