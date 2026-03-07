'use strict';

class MemoryRateLimitStore {
  constructor() {
    this.state = new Map();
  }

  async increment(key, windowMs) {
    const now = Date.now();
    const entry = this.state.get(key) || { count: 0, windowStart: now };
    if (now - entry.windowStart > windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    this.state.set(key, entry);
    return entry.count;
  }
}

class RedisRateLimitStore {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async increment(key, windowMs) {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }
    return count;
  }
}

module.exports = { MemoryRateLimitStore, RedisRateLimitStore };
