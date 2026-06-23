import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import bcrypt from "bcryptjs";
import { CHIP_COLORS, type ChipWallet } from "../domain/chips.js";
import { InvalidCredentialsError } from "../domain/errors.js";
import type { DataStore } from "../store/types.js";

const BCRYPT_ROUNDS = 10;

const Credentials = Type.Object({
  email: Type.String({ pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", maxLength: 254 }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
});

const AuthResponse = Type.Object({
  token: Type.String(),
  userId: Type.String(),
  role: Type.Union([Type.Literal("user"), Type.Literal("admin")]),
});

const DevTokenBody = Type.Object({
  userId: Type.String({ minLength: 1 }),
  role: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("admin")])),
});

const DevTokenResponse = Type.Object({ token: Type.String() });

/**
 * Real email/password auth backed by the DataStore. Passwords are hashed with
 * bcrypt; a JWT carrying the user id and role is returned on success. A
 * non-production `dev-token` helper remains for local testing only.
 */
export function authRoutes(store: DataStore, isProduction: boolean, welcomeChips: ChipWallet) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    app.post(
      "/auth/register",
      { schema: { body: Credentials, response: { 201: AuthResponse } } },
      async (request, reply) => {
        const passwordHash = await bcrypt.hash(request.body.password, BCRYPT_ROUNDS);
        const user = await store.createUser({ email: request.body.email, passwordHash });
        await store.getOrCreateWallet(user.userId);
        for (const color of CHIP_COLORS) {
          if (welcomeChips[color] > 0) {
            await store.creditWallet(user.userId, color, welcomeChips[color]);
          }
        }
        const token = await fastify.jwt.sign({ sub: user.userId, role: user.role });
        reply.status(201);
        return { token, userId: user.userId, role: user.role };
      },
    );

    app.post(
      "/auth/login",
      { schema: { body: Credentials, response: { 200: AuthResponse } } },
      async (request) => {
        const user = await store.getUserByEmail(request.body.email);
        const ok = user && (await bcrypt.compare(request.body.password, user.passwordHash));
        if (!user || !ok) throw new InvalidCredentialsError();
        const token = await fastify.jwt.sign({ sub: user.userId, role: user.role });
        return { token, userId: user.userId, role: user.role };
      },
    );

    if (isProduction) return;

    app.post(
      "/auth/dev-token",
      { schema: { body: DevTokenBody, response: { 200: DevTokenResponse } } },
      async (request) => {
        const { userId, role } = request.body;
        const token = await fastify.jwt.sign({ sub: userId, role: role ?? "user" });
        return { token };
      },
    );
  };
}
