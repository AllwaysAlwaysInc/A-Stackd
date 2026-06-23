import Constants from "expo-constants";

export type ChipColor = "red" | "white" | "blue" | "black";
export type Role = "user" | "admin";

export type ChipStacks = Record<ChipColor, number>;

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface AuthResult {
  token: string;
  userId: string;
  role: Role;
}

export interface Wallet {
  userId: string;
  stacks: ChipStacks;
}

export interface Pool {
  poolId: string;
  prize: string;
  type: string;
  isGuaranteed: boolean;
  requiredChip: ChipColor;
  status: string;
  timeLeft: string;
  meltingMultiplier: number;
  salesAgentAlert?: string;
  drawnAt?: number;
  winnerUserId?: string;
  winningTicketId?: string;
}

export interface Ticket {
  id: string;
  batchId: string;
  poolId: string;
  userId: string;
  chipColor: ChipColor;
  seatNumber: number;
  createdAt: number;
  shippingAddress: ShippingAddress;
}

export interface BuyResult {
  success: boolean;
  ticketId: string;
  seats: number;
  msg: string;
}

/** API error carrying the backend's stable machine-readable code. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Resolve the backend base URL. Priority:
 *   1. EXPO_PUBLIC_API_URL env (set at build/run time)
 *   2. `expo.extra.apiUrl` in app.json
 *   3. localhost fallback for local web dev
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra.replace(/\/$/, "");
  return "http://localhost:3000";
}

export const API_BASE_URL = resolveBaseUrl();

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", `Could not reach the server at ${API_BASE_URL}.`);
  }

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? `Request failed (${res.status}).`);
  }
  return body as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResult>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  wallet: () => request<Wallet>("/wallet"),
  activePools: () => request<{ pools: Pool[] }>("/active-pools").then((r) => r.pools),
  pool: (poolId: string) => request<Pool>(`/pools/${encodeURIComponent(poolId)}`),
  tickets: () => request<{ tickets: Ticket[] }>("/tickets").then((r) => r.tickets),
  buyTicket: (poolId: string, chipColor: ChipColor, shippingAddress: ShippingAddress) =>
    request<BuyResult>("/buy-ticket", {
      method: "POST",
      body: JSON.stringify({ poolId, chipColor, shippingAddress }),
    }),
};
