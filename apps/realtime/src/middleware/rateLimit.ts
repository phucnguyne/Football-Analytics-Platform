// ─── middleware/rateLimit.ts ──────────────────────────────────────────────────
// Giới hạn số event mỗi socket có thể gửi trong 1 cửa sổ thời gian.
// Dùng in-memory Map — nếu dùng multi-process thì cần chuyển sang Redis.

import type { Socket } from "socket.io";

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

// socketId → { count, resetAt }
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware(opts: Partial<RateLimitOptions> = {}) {
  const { maxEvents, windowMs } = { ...DEFAULT_OPTIONS, ...opts };

  return (socket: Socket, next: NextFn): void => {
    // Khởi tạo bucket cho socket này
    store.set(socket.id, { count: 0, resetAt: Date.now() + windowMs });

    socket.use(([event], nextEvent) => {
      // Bỏ qua event nội bộ của Socket.io
      if (event.startsWith("socket.io")) return nextEvent();

      const now = Date.now();
      const bucket = store.get(socket.id)!;

      if (now > bucket.resetAt) {
        bucket.count = 0;
        bucket.resetAt = now + windowMs;
      }

      bucket.count += 1;

      if (bucket.count > maxEvents) {
        socket.emit("error", {
          code: "RATE_LIMITED",
          message: `Quá ${maxEvents} event / ${windowMs / 1000}s. Thử lại sau.`,
        });
        // Không gọi nextEvent → event bị bỏ
        return;
      }

      nextEvent();
    });

    // Dọn dẹp khi disconnect
    socket.on("disconnect", () => store.delete(socket.id));

    next();
  };
}
