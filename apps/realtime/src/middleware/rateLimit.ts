// ─── middleware/rateLimit.ts ──────────────────────────────────────────────────
// Giới hạn số event mỗi socket có thể gửi trong 1 cửa sổ thời gian.

import type { Socket } from "socket.io";
import { getRedisClient } from "../config/redis";

type NextFn = (err?: Error) => void;

interface RateLimitOptions {
  /** Số event tối đa trong cửa sổ thời gian */
  maxEvents: number;
  /** Cửa sổ thời gian tính bằng ms (mặc định: 10 000) */
  windowMs: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxEvents: 30,
  windowMs: 10_000,
};

// Used only when Redis is not configured (development and tests).
const store = new Map<string, { count: number; resetAt: number }>();

const INCREMENT_RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

export function rateLimitMiddleware(opts: Partial<RateLimitOptions> = {}) {
  const { maxEvents, windowMs } = { ...DEFAULT_OPTIONS, ...opts };

  return (socket: Socket, next: NextFn): void => {
    const connectedAt = Date.now();
    if (!getRedisClient()) {
      store.set(socket.id, { count: 0, resetAt: connectedAt + windowMs });
    }

    socket.use(([event], nextEvent) => {
      // Bỏ qua event nội bộ của Socket.io
      if (event.startsWith("socket.io")) return nextEvent();

      const now = Date.now();
      const redis = getRedisClient();
      const checkLimit = redis
        ? redis.eval(INCREMENT_RATE_LIMIT_SCRIPT, {
            keys: [
              `realtime:rate-limit:${socket.id}:${Math.floor((now - connectedAt) / windowMs)}`,
            ],
            arguments: [String(windowMs - ((now - connectedAt) % windowMs))],
          })
        : Promise.resolve(incrementMemoryBucket(socket.id, now, windowMs));

      void checkLimit
        .then((count) => {
          if (typeof count !== "number") {
            throw new Error("Redis returned an invalid rate-limit counter");
          }
          if (count > maxEvents) {
            socket.emit("error", {
              code: "RATE_LIMITED",
              message: `Quá ${maxEvents} event / ${windowMs / 1000}s. Thử lại sau.`,
            });
            return;
          }
          nextEvent();
        })
        .catch((error: unknown) => {
          console.error("[rate-limit] failed to check event limit:", error);
          socket.emit("error", {
            code: "RATE_LIMIT_UNAVAILABLE",
            message: "Không thể kiểm tra giới hạn event. Thử lại sau.",
          });
        });
    });

    // Dọn dẹp khi disconnect
    socket.on("disconnect", () => store.delete(socket.id));

    next();
  };
}

function incrementMemoryBucket(
  socketId: string,
  now: number,
  windowMs: number,
): number {
  const bucket = store.get(socketId);
  if (!bucket)
    throw new Error(`Rate-limit bucket not found for socket ${socketId}`);
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  return bucket.count;
}
