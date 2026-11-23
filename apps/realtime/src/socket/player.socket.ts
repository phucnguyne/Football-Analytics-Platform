import type { Socket } from "socket.io";
import { handleGetPlayerStats, handleGetMatchLineup } from "../handlers/player.handler";
import { matchPayload, playerPayload } from "./payload";

export function registerPlayerSocket(socket: Socket): void {
  socket.on("player:get-stats", async (input: unknown) => {
    const parsed = playerPayload.safeParse(input);
    if (!parsed.success) return;
    const { matchId, playerId } = parsed.data;
    const stats = await handleGetPlayerStats(matchId, playerId);
    if (stats.ok) socket.emit("player:stats", stats.data);
    else socket.emit("error", { code: "NOT_FOUND", message: stats.error });
  });

  socket.on("player:get-lineup", async (input: unknown) => {
    const parsed = matchPayload.safeParse(input);
    if (parsed.success) socket.emit("player:lineup", await handleGetMatchLineup(parsed.data.matchId));
  });
}
