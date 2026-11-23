import type { Socket } from "socket.io";
import { handleGetAllLiveScores, handleGetScore } from "../handlers/match.handler";
import { matchPayload } from "./payload";

export function registerMatchSocket(socket: Socket): void {
  socket.on("match:join", async (input: unknown) => {
    const parsed = matchPayload.safeParse(input);
    if (!parsed.success || socket.rooms.size >= 51) return;
    const { matchId } = parsed.data;
    await socket.join(`match:${matchId}`);
    const score = await handleGetScore(matchId);
    if (score.ok) socket.emit("match:score", score.data);
  });

  socket.on("match:leave", async (input: unknown) => {
    const parsed = matchPayload.safeParse(input);
    if (parsed.success) await socket.leave(`match:${parsed.data.matchId}`);
  });

  socket.on("match:get-score", async (input: unknown) => {
    const parsed = matchPayload.safeParse(input);
    if (!parsed.success) return;
    const score = await handleGetScore(parsed.data.matchId);
    if (score.ok) socket.emit("match:score", score.data);
    else socket.emit("error", { code: "NOT_FOUND", message: score.error });
  });

  socket.on("match:get-all-live", async () => {
    socket.emit("match:all-live", await handleGetAllLiveScores());
  });
}
