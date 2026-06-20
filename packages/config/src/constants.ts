export const CONSTANTS = {
  RATE_LIMITS: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60000,
  },
  CACHE_TTL: {
    MATCHES: 60 * 5, // 5 minutes
    STANDINGS: 60 * 60, // 1 hour
    PLAYERS: 60 * 60 * 24, // 1 day
  },
};
