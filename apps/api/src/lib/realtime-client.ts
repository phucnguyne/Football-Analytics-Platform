/**
 * Module này cho phép `api` (Fastify) báo cho `realtime` (Socket.io server)
 * biết để broadcast event tới các client đang subscribe.
 *
 * Luồng: api xử lý request -> ghi DB -> gọi REALTIME_INTERNAL_URL/internal/emit
 *        -> realtime server nhận, gọi io.emit(...) tới room/channel tương ứng.
 *
 * Đây KHÔNG phải kết nối socket trực tiếp từ api (api không giữ socket client),
 * mà là một HTTP call nội bộ, xác thực bằng header secret riêng.
 */

const REALTIME_INTERNAL_URL = process.env.REALTIME_INTERNAL_URL ?? "http://localhost:3002";
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? "";

interface EmitPayload {
  /** Tên event phía client sẽ lắng nghe, ví dụ: "score:updated" */
  event: string;
  /** Room/channel để emit tới, ví dụ: "live-scores" */
  room?: string;
  /** Dữ liệu gửi kèm event */
  data: unknown;
}

/**
 * Gọi sang realtime server để emit event.
 * Lỗi ở đây sẽ KHÔNG throw ra ngoài — chỉ log — để không làm fail
 * request chính của client (ví dụ update score vẫn phải trả 200
 * dù realtime server đang down).
 */
export async function notifyRealtime(payload: EmitPayload): Promise<void> {
  try {
    const res = await fetch(`${REALTIME_INTERNAL_URL}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SERVICE_SECRET,
      },
      body: JSON.stringify(payload),
      // Không để request này treo quá lâu, realtime server phải trả lời nhanh
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      console.error(
        `[notifyRealtime] realtime server trả về ${res.status} cho event "${payload.event}"`
      );
    }
  } catch (err) {
    console.error(`[notifyRealtime] không gọi được realtime server:`, err);
  }
}
