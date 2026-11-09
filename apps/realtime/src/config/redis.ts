import { createClient } from "redis";
import { env } from "./env";

function createRedisClient() {
  if (!env.redisUrl) return null;
  return createClient({
    url: env.redisUrl,
    socket: {
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  });
}

const client = createRedisClient();
type RedisClient = NonNullable<typeof client>;

export interface RedisConnections {
  client: RedisClient;
  pubClient: RedisClient;
  subClient: RedisClient;
}

function logRedisErrors(redisClient: RedisClient): void {
  redisClient.on("error", (error) => {
    console.error("[redis] connection error:", error);
  });
}

if (client) logRedisErrors(client);

export function getRedisClient(): RedisClient | null {
  return client;
}

export async function connectRedis(): Promise<RedisConnections | null> {
  if (!client) return null;

  const pubClient = createRedisClient();
  const subClient = createRedisClient();
  if (!pubClient || !subClient)
    throw new Error("Redis client configuration is inconsistent");
  logRedisErrors(pubClient);
  logRedisErrors(subClient);

  try {
    await Promise.all([
      client.connect(),
      pubClient.connect(),
      subClient.connect(),
    ]);
  } catch (error) {
    await Promise.allSettled([
      client.isOpen ? client.quit() : Promise.resolve(),
      pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
      subClient.isOpen ? subClient.quit() : Promise.resolve(),
    ]);
    throw error;
  }

  return { client, pubClient, subClient };
}

export async function closeRedisConnections(
  connections: RedisConnections,
): Promise<void> {
  await Promise.all([
    connections.client.quit(),
    connections.pubClient.quit(),
    connections.subClient.quit(),
  ]);
}
