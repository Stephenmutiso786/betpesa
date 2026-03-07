'use strict';

class MemorySessionStore {
  constructor() {
    this.map = new Map();
  }

  async set(jti, userId, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.map.set(jti, { userId, expiresAt });
  }

  async has(jti) {
    const entry = this.map.get(jti);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(jti);
      return false;
    }
    return true;
  }

  async del(jti) {
    this.map.delete(jti);
  }
}

class RedisSessionStore {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async set(jti, userId, ttlSeconds) {
    await this.redis.set(`session:${jti}`, userId, { EX: ttlSeconds });
  }

  async has(jti) {
    const value = await this.redis.get(`session:${jti}`);
    return !!value;
  }

  async del(jti) {
    await this.redis.del(`session:${jti}`);
  }
}

module.exports = { MemorySessionStore, RedisSessionStore };
