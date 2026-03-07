'use strict';

module.exports = {
  ingestProviderOdds: async () => {
    throw new Error('TODO: ingest and normalize provider odds');
  },
  updateMarketOdds: async () => {
    throw new Error('TODO: update market odds with versioning');
  },
  getLiveOdds: async () => {
    throw new Error('TODO: read live odds from Redis cache fallback to PostgreSQL');
  }
};
