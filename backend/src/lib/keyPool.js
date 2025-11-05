// backend/src/lib/keyPool.js
// ✅ Proportional API key usage with 60/40 phase split and cooldowns
// - Per-key usage tracked by phase: search (60%) and tracks (40%)
// - Selection chooses key with lowest phase usedPercent; ties round-robin
// - Cooldown 60 min on quotaExceeded/userRateLimitExceeded
// - Per-key min interval 500ms (≤ 2 req/s per key)

const COSTS = {
  'search.list': 100,
  'playlists.list': 1,
  'playlistItems.list': 1,
};

const ENDPOINT_PHASE = {
  'search.list': 'search',
  'playlists.list': 'tracks',
  'playlistItems.list': 'tracks',
};

function now() { return Date.now(); }

export class KeyPool {
  constructor(keys, opts = {}) {
    this.quotas = { search: 6000, tracks: 4000 };
    this.dailyLimit = opts.dailyLimit || 10000; // per key
    this.keys = (keys || []).map((k, i) => ({
      key: k,
      index: i,
      used: { search: 0, tracks: 0 },
      cooldownUntil: 0,
      lastUseAt: 0,
    }));
    this.pointer = 0; // for tie-breaking
  }

  size() { return this.keys.length; }

  phaseFor(endpoint) { return ENDPOINT_PHASE[endpoint] || 'tracks'; }

  usedPercentPhase(k, phase) {
    const q = this.quotas[phase] || 1;
    const u = (k.used?.[phase] || 0);
    return Math.min(1, u / q);
  }

  totalUsed(k) { return (k.used?.search || 0) + (k.used?.tracks || 0); }

  poolUsedPercent() {
    const total = this.keys.reduce((s, k) => s + this.totalUsed(k), 0);
    const cap = this.size() * this.dailyLimit;
    return cap ? total / cap : 0;
  }

  isAvailable(k) { return now() >= (k.cooldownUntil || 0); }

  // per-key rate limit: ≤ 2 req/s => at least 500ms between uses of same key
  async rateLimitFor(keyObj) {
    const minGap = 500; // ms per key
    const wait = Math.max(0, (keyObj.lastUseAt + minGap) - now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }

  // Select key with minimal used percent for the endpoint's phase
  async selectKey(endpoint) {
    if (!this.keys.length) throw new Error('No API keys');
    const phase = this.phaseFor(endpoint);
    const candidates = this.keys.filter(k => this.isAvailable(k));
    if (candidates.length === 0) {
      // all cooled down — short backoff and pick next
      await new Promise(r => setTimeout(r, 2000));
      const pick = this.keys[this.pointer % this.keys.length];
      await this.rateLimitFor(pick);
      return pick;
    }
    const byPercent = candidates.slice().sort((a, b) => this.usedPercentPhase(a, phase) - this.usedPercentPhase(b, phase));
    const min = this.usedPercentPhase(byPercent[0], phase);
    const within = byPercent.filter(k => Math.abs(this.usedPercentPhase(k, phase) - min) <= 0.005);
    const pick = within[this.pointer % within.length];
    this.pointer = (this.pointer + 1) % this.keys.length;
    await this.rateLimitFor(pick);
    return pick;
  }

  checkExhaustion() {
    // If overall pool usage >= 90% of daily limit, freeze keys until reset
    if (this.poolUsedPercent() >= 0.9) {
      const until = now() + 23 * 60 * 60 * 1000; // effectively rest of day
      for (const k of this.keys) k.cooldownUntil = Math.max(k.cooldownUntil, until);
    }
  }

  markUsage(keyString, endpoint, ok = true) {
    const cost = COSTS[endpoint] ?? 1;
    const phase = this.phaseFor(endpoint);
    const obj = this.keys.find(k => k.key === keyString);
    if (!obj) return;
    if (ok) obj.used[phase] = (obj.used?.[phase] || 0) + cost;
    obj.lastUseAt = now();
    this.checkExhaustion();
  }

  setCooldown(keyString, minutes = 60) {
    const obj = this.keys.find(k => k.key === keyString);
    if (!obj) return;
    obj.cooldownUntil = now() + minutes * 60 * 1000;
  }

  resetDaily() {
    for (const k of this.keys) { k.used = { search: 0, tracks: 0 }; k.cooldownUntil = 0; }
    this.pointer = 0;
  }

  report() {
    return this.keys.map(k => ({
      keyPrefix: String(k.key).slice(0, 8),
      usedSearch: k.used?.search || 0,
      usedTracks: k.used?.tracks || 0,
      usedPercentSearch: +(100 * this.usedPercentPhase(k, 'search')).toFixed(2),
      usedPercentTracks: +(100 * this.usedPercentPhase(k, 'tracks')).toFixed(2),
      cooldownUntil: k.cooldownUntil || 0,
    }));
  }

  phaseReport() {
    const searchTotal = this.keys.reduce((s, k) => s + (k.used?.search || 0), 0);
    const tracksTotal = this.keys.reduce((s, k) => s + (k.used?.tracks || 0), 0);
    const percentsSearch = this.keys.map(k => this.usedPercentPhase(k, 'search') * 100);
    const percentsTracks = this.keys.map(k => this.usedPercentPhase(k, 'tracks') * 100);
    const stat = (arr) => ({
      avg: +(arr.reduce((a, b) => a + b, 0) / (arr.length || 1)).toFixed(2),
      min: +((arr.length ? Math.min(...arr) : 0).toFixed(2)),
      max: +((arr.length ? Math.max(...arr) : 0).toFixed(2)),
    });
    return {
      usageSummary: { search: searchTotal, tracks: tracksTotal },
      perKey: this.report(),
      keyStats: {
        search: stat(percentsSearch),
        tracks: stat(percentsTracks),
      },
    };
  }
}

export const COST_TABLE = COSTS;
export const ENDPOINT_PHASE_TABLE = ENDPOINT_PHASE;
