// 🔄 CLEANUP DIRECTIVE
// Full rewrite — remove any previous code before applying this version.

/**
 * Fetches all tracks from a given YouTube playlist.
 * Returns an array of track objects with id, title, artist, duration, and cover.
 * Works with official YouTube Data API v3.
 */

const YT_API_KEY = process.env.YOUTUBE_API_KEY;

export async function getTracksFromYouTube(playlistId) {
  if (!YT_API_KEY) {
    console.warn("[youtube] Missing YOUTUBE_API_KEY in environment");
    return [];
  }

  const base = "https://www.googleapis.com/youtube/v3/playlistItems";
  let nextPage = null;
  let all = [];

  try {
    do {
      const url = new URL(base);
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("key", YT_API_KEY);
      if (nextPage) url.searchParams.set("pageToken", nextPage);

      // ✅ native fetch (built into Node 18+)
      const res = await fetch(url.href);
      const json = await res.json();

      if (!res.ok) {
        console.warn(`[youtube] ${playlistId}: API error → ${json.error?.message || "unknown error"}`);
        break;
      }

      const items = json.items || [];
      const tracks = items
        .filter((i) => i.snippet && i.snippet.title !== "Private video" && i.snippet.title !== "Deleted video")
        .map((i) => ({
          id: i.contentDetails.videoId,
          title: i.snippet.title,
          artist: i.snippet.videoOwnerChannelTitle || null,
          cover: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.default?.url || null,
          duration: null
        }));

      all = all.concat(tracks);
      nextPage = json.nextPageToken || null;
    } while (nextPage);

    return all;
  } catch (err) {
    console.warn(`[youtube] ${playlistId}: failed → ${err.message}`);
    return [];
  }
}
