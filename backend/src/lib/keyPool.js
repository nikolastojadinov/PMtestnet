// backend/src/lib/keyPool.js
// ✅ Proportional API key usage with cooldowns and basic QPS shaping
// - Tracks usedUnits per key (approximate cost per endpoint)
// - Chooses key with smallest usedPercent; ties resolved round-robin
// - Cooldown (60 min) on quotaExceeded / userRateLimitExceeded
// - Per-key min interval to enforce <= 2 req/s per key

const COSTS = {
  'search.list': 100,
  'playlists.list': 1,
  'playlistItems.list': 1,
};

function now() { return Date.now(); }

export class KeyPool {
  constructor(keys, opts = {}) {
    this.keys = (keys || []).map((k, i) => ({
      key: k,
      index: i,
      usedUnits: 0,
      cooldownUntil: 0,
      lastUseAt: 0,
    }));
    this.dailyLimit = opts.dailyLimit || 10000; // per key
    this.pointer = 0; // for tie-breaking
    this.globalLastUse = 0;
  }

  size() { return this.keys.length; }

  usedPercent(k) {
    return Math.min(1, (k.usedUnits || 0) / this.dailyLimit);
  }

  isAvailable(k) {
    return now() >= (k.cooldownUntil || 0);
  }

  // per-key rate limit: <= 2 req/s => at least 500ms between uses of same key
  async rateLimitFor(keyObj) {
    const minGap = 500; // ms per key
    const wait = Math.max(0, (keyObj.lastUseAt + minGap) - now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }

  // Select key with minimal usedPercent among available; ties break round-robin
  async selectKey(endpoint) {
    if (!this.keys.length) throw new Error('No API keys');
    const candidates = this.keys.filter(k => this.isAvailable(k));
    if (candidates.length === 0) {
      // all cooled down — wait small backoff and retry current pointer
      await new Promise(r => setTimeout(r, 2000));
      return this.keys[this.pointer % this.keys.length];
    }
    const byPercent = candidates.slice().sort((a, b) => this.usedPercent(a) - this.usedPercent(b));
    // Find all with the lowest percent (within ±0.5%) to round-robin among them
    const min = this.usedPercent(byPercent[0]);
    const within = byPercent.filter(k => Math.abs(this.usedPercent(k) - min) <= 0.005);
    const pick = within[this.pointer % within.length];
    this.pointer = (this.pointer + 1) % this.keys.length;
    await this.rateLimitFor(pick);
    return pick;
  }

  markUsage(keyString, endpoint, ok = true) {
    const cost = COSTS[endpoint] ?? 1;
    const obj = this.keys.find(k => k.key === keyString);
    if (!obj) return;
    if (ok) obj.usedUnits += cost;
    obj.lastUseAt = now();
  }

  setCooldown(keyString, minutes = 60) {
    const obj = this.keys.find(k => k.key === keyString);
    if (!obj) return;
    obj.cooldownUntil = now() + minutes * 60 * 1000;
  }

  resetDaily() {
    for (const k of this.keys) { k.usedUnits = 0; k.cooldownUntil = 0; }
    this.pointer = 0;
  }

  report() {
    return this.keys.map(k => ({
      keyPrefix: String(k.key).slice(0, 8),
      usedUnits: k.usedUnits,
      usedPercent: +(100 * this.usedPercent(k)).toFixed(2),
      cooldownUntil: k.cooldownUntil || 0,
    }));
  }
}

export const COST_TABLE = COSTS;
