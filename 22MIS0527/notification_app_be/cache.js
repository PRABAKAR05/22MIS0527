// ─────────────────────────────────────────────────
// Stage 4: In-Memory Cache (simulates Redis)
// Prevents database overload with TTL-based caching
// ─────────────────────────────────────────────────

class Cache {

    constructor() {
        this.store = new Map();
        this.ttls = new Map();      // key → expiry timestamp
        this.hits = 0;
        this.misses = 0;
    }

    // ─── SET with TTL (seconds) ───
    set(key, value, ttlSeconds = 60) {

        this.store.set(key, value);
        this.ttls.set(key, Date.now() + ttlSeconds * 1000);

        console.log(`   💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    }

    // ─── GET (returns null if expired or missing) ───
    get(key) {

        // Check if key exists
        if (!this.store.has(key)) {
            this.misses++;
            return null;
        }

        // Check if expired
        const expiry = this.ttls.get(key);

        if (expiry && Date.now() > expiry) {
            // TTL expired — remove and return null
            this.store.delete(key);
            this.ttls.delete(key);
            this.misses++;
            console.log(`   💾 Cache EXPIRED: ${key}`);
            return null;
        }

        this.hits++;
        console.log(`   💾 Cache HIT: ${key}`);
        return this.store.get(key);
    }

    // ─── DELETE (cache invalidation) ───
    del(key) {

        this.store.delete(key);
        this.ttls.delete(key);

        console.log(`   💾 Cache INVALIDATED: ${key}`);
    }

    // ─── Invalidate all keys matching a pattern ───
    invalidatePattern(pattern) {

        let count = 0;

        for (const key of this.store.keys()) {
            if (key.includes(pattern)) {
                this.store.delete(key);
                this.ttls.delete(key);
                count++;
            }
        }

        if (count > 0) {
            console.log(`   💾 Cache INVALIDATED ${count} keys matching "${pattern}"`);
        }
    }

    // ─── Stats ───
    getStats() {
        return {
            entries: this.store.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits + this.misses > 0
                ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + "%"
                : "0%"
        };
    }

    // ─── Flush all ───
    flush() {
        this.store.clear();
        this.ttls.clear();
        console.log("   💾 Cache FLUSHED");
    }
}

module.exports = new Cache();
