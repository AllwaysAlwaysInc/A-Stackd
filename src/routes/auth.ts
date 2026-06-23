import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import bcrypt from "bcryptjs";
import { CHIP_COLORS, type ChipWallet } from "../domain/chips.js";
import {
  InvalidCredentialsError,
  UnderageError,
  TermsConsentRequiredError,
  UnauthorizedError
} from "../domain/errors.js";
import type { DataStore } from "../store/types.js";

const BCRYPT_ROUNDS = 10;

const RegisterBody = Type.Object({
  email: Type.String({ pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", maxLength: 254 }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
  dateOfBirth: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  consentToTerms: Type.Boolean(),
});

const LoginBody = Type.Object({
  email: Type.String({ pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", maxLength: 254 }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
});

const AuthResponse = Type.Object({
  token: Type.String(),
  userId: Type.String(),
  role: Type.Union([Type.Literal("user"), Type.Literal("admin")]),
  emailVerified: Type.Boolean(),
});

const VerifyEmailBody = Type.Object({
  email: Type.String(),
  token: Type.String(),
});

const ForgotPasswordBody = Type.Object({
  email: Type.String(),
});

const ResetPasswordBody = Type.Object({
  token: Type.String(),
  password: Type.String({ minLength: 8, maxLength: 128 }),
});

const ProfileResponse = Type.Object({
  userId: Type.String(),
  email: Type.String(),
  dateOfBirth: Type.Optional(Type.String()),
  emailVerified: Type.Boolean(),
});

const UpdateProfileBody = Type.Object({
  dateOfBirth: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
});

export function authRoutes(store: DataStore, isProduction: boolean, welcomeChips: ChipWallet) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    app.post(
      "/auth/register",
      { schema: { body: RegisterBody, response: { 201: AuthResponse } } },
      async (request, reply) => {
        const { email, password, dateOfBirth, consentToTerms } = request.body;

        if (!consentToTerms) {
          throw new TermsConsentRequiredError();
        }

        // Verify age is 18+
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) {
          throw new Error("Invalid dateOfBirth format.");
        }
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 18) {
          throw new UnderageError();
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric code
        
        console.log(`[VERIFICATION] Email verification token for ${email}: ${emailVerificationToken}`);

        const user = await store.createUser({
          email,
          passwordHash,
          dateOfBirth,
          consentAt: Date.now(),
          emailVerificationToken,
        });

        await store.getOrCreateWallet(user.userId);
        for (const color of CHIP_COLORS) {
          if (welcomeChips[color] > 0) {
            await store.creditWallet(user.userId, color, welcomeChips[color]);
          }
        }

        const token = await fastify.jwt.sign({ sub: user.userId, role: user.role });
        reply.status(201);
        return { token, userId: user.userId, role: user.role, emailVerified: false };
      },
    );

    app.post(
      "/auth/login",
      { schema: { body: LoginBody, response: { 200: AuthResponse } } },
      async (request) => {
        const user = await store.getUserByEmail(request.body.email);
        const ok = user && (await bcrypt.compare(request.body.password, user.passwordHash));
        if (!user || !ok) throw new InvalidCredentialsError();
        const token = await fastify.jwt.sign({ sub: user.userId, role: user.role });
        return { token, userId: user.userId, role: user.role, emailVerified: user.emailVerified ?? false };
      },
    );

    app.post(
      "/auth/verify-email",
      { schema: { body: VerifyEmailBody } },
      async (request) => {
        const { email, token } = request.body;
        const user = await store.getUserByEmail(email);
        if (!user) throw new InvalidCredentialsError();
        const verified = await store.verifyEmail(user.userId, token);
        if (!verified) {
          throw new Error("Invalid or expired verification token.");
        }
        return { success: true, message: "Email verified successfully." };
      }
    );

    app.post(
      "/auth/forgot-password",
      { schema: { body: ForgotPasswordBody } },
      async (request) => {
        const { email } = request.body;
        const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit reset code
        const expires = Date.now() + 3600 * 1000; // 1 hour expiry
        const ok = await store.sendForgotPassword(email, token, expires);
        console.log(`[PASSWORD RESET] Forgot password token for ${email}: ${token}`);
        return { success: true, message: "If the email exists, a reset code has been sent." };
      }
    );

    app.post(
      "/auth/reset-password",
      { schema: { body: ResetPasswordBody } },
      async (request) => {
        const { token, password } = request.body;
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const ok = await store.resetPassword(token, passwordHash);
        if (!ok) {
          throw new Error("Invalid or expired password reset token.");
        }
        return { success: true, message: "Password has been reset successfully." };
      }
    );

    // Private profile routes (automatically protected via JWT auth hook)
    app.get(
      "/profile",
      { schema: { response: { 200: ProfileResponse } } },
      async (request) => {
        const user = await store.getUserById(request.userId);
        if (!user) throw new UnauthorizedError();
        return {
          userId: user.userId,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          emailVerified: user.emailVerified ?? false,
        };
      }
    );

    app.put(
      "/profile",
      { schema: { body: UpdateProfileBody, response: { 200: ProfileResponse } } },
      async (request) => {
        const user = await store.updateProfile(request.userId, request.body);
        return {
          userId: user.userId,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          emailVerified: user.emailVerified ?? false,
        };
      }
    );

    if (isProduction) return;

    app.post(
      "/auth/dev-token",
      {
        schema: {
          body: Type.Object({
            userId: Type.String(),
            role: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("admin")]))
          })
        }
      },
      async (request) => {
        const { userId, role } = request.body;
        const token = await fastify.jwt.sign({ sub: userId, role: role ?? "user" });
        return { token };
      },
    );
  };
}
