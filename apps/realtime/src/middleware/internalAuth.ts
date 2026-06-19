// ─── middleware/internalAuth.ts ───────────────────────────────────────────────
// Xác thực request HTTP nội bộ từ service khác (ví dụ: api) gọi sang route
// /internal/emit. Đây KHÔNG phải JWT của user — chỉ là 1 secret dùng chung
// giữa các service trong hệ thống (đặt trong .env: INTERNAL_SERVICE_SECRET).

import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export function internalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = req.headers["x-internal-secret"];

  if (!env.internalServiceSecret) {
    console.warn(
      "⚠️  INTERNAL_SERVICE_SECRET chưa được cấu hình — từ chối mọi request nội bộ."
    );
    res.status(503).json({ error: "Internal endpoint not configured" });
    return;
  }

  if (secret !== env.internalServiceSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}