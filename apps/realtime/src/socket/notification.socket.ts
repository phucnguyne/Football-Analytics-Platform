import type { Socket } from "socket.io";
import {
  handleSubscribe,
  handleUnsubscribe,
  handleGetSubscriptions,
  handleDisconnect,
} from "../handlers/notification.handler";
import { matchPayload } from "./payload";

export function registerNotificationSocket(socket: Socket): void {
  const subscriber = socket.id;

  socket.on("notification:subscribe", (input: unknown) => {
    const parsed = matchPayload.safeParse(input);
    if (!parsed.success || handleGetSubscriptions(subscriber).length >= 50) return;
    const { matchId } = parsed.data;
    handleSubscribe(subscriber, matchId);
    socket.emit("notification:subscribed", { matchId, subs: handleGetSubscriptions(subscriber) });
  });

  socket.on("notification:unsubscribe", (input: unknown) => {
    const parsed = matchPayload.safeParse(input);
    if (!parsed.success) return;
    handleUnsubscribe(subscriber, parsed.data.matchId);
    socket.emit("notification:subscribed", { matchId: null, subs: handleGetSubscriptions(subscriber) });
  });

  socket.on("notification:get-subs", () => {
    socket.emit("notification:subs-list", handleGetSubscriptions(subscriber));
  });

  socket.on("disconnect", () => handleDisconnect(subscriber));
}
