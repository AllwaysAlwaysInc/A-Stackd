import { Type } from "@sinclair/typebox";

export const ChipColorSchema = Type.Union([
  Type.Literal("red"),
  Type.Literal("white"),
  Type.Literal("blue"),
  Type.Literal("black"),
]);

export const WalletResponseSchema = Type.Object({
  userId: Type.String(),
  stacks: Type.Object({
    red: Type.Integer(),
    white: Type.Integer(),
    blue: Type.Integer(),
    black: Type.Integer(),
  }),
});

export const BuyTicketBodySchema = Type.Object({
  poolId: Type.String({ minLength: 1 }),
  chipColor: ChipColorSchema,
  shippingAddress: Type.String({ minLength: 1 }),
});

export const BuyTicketResponseSchema = Type.Object({
  success: Type.Boolean(),
  ticketId: Type.String(),
  seats: Type.Integer(),
  msg: Type.String(),
});

export const PoolSchema = Type.Object({
  poolId: Type.String(),
  prize: Type.String(),
  type: Type.String(),
  isGuaranteed: Type.Boolean(),
  requiredChip: ChipColorSchema,
  status: Type.String(),
  timeLeft: Type.String(),
  meltingMultiplier: Type.Number(),
  salesAgentAlert: Type.Optional(Type.String()),
});

export const ActivePoolsResponseSchema = Type.Object({
  pools: Type.Array(PoolSchema),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
});
