import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import type { DataStore } from "../store/types.js";

export function notificationRoutes(store: DataStore) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    app.get(
      "/notifications",
      async (request) => {
        const notifications = await store.getNotifications(request.userId);
        return { notifications };
      }
    );

    app.post(
      "/notifications/read",
      async (request) => {
        await store.markNotificationsRead(request.userId);
        return { success: true };
      }
    );
  };
}
