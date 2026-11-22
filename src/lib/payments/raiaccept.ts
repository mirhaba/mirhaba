import "server-only";
import { z } from "zod";
import { paymentsConfig } from "./config";

/**
 * Thin RaiAccept REST client (https://docs.raiaccept.com/code-integration.html).
 * Every answer is validated with zod; anything unexpected throws RaiAcceptError and the caller treats
 * the payment as "not confirmed" (never as paid).
 */

export class RaiAcceptError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;
// The Auth Service rejects requests without a real User-Agent (docs → Troubleshooting).
const USER_AGENT = "Mirhaba/1.0 (+https://mirhaba.vercel.app)";
const INTEGRATION = { type: "CODE", data: { name: "Mirhaba", version: "1.0.0", vendor: "Mirhaba" } } as const;

// ---------- Auth: short-lived access token, cached per server instance ----------
const loginSchema = z.object({
  accessToken: z.string().min(10),
  accessTokenExpiresIn: z.number().positive(),
  refreshToken: z.string().min(10).optional(),
  refreshTokenExpiresIn: z.number().positive().optional(),
});

type Tokens = { access: string; accessUntil: number; refresh?: string; refreshUntil: number; user: string };
let tokens: Tokens | null = null;
let pending: Promise<string> | null = null;

async function postJson(url: string, body: unknown, accessToken?: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  // Keep the RaiAccept error code/message for logs; never include our request body (credentials).
  return `${res.status} ${text.slice(0, 300)}`;
}

async function login(): Promise<string> {
  const config = paymentsConfig();
  if (!config.configured) throw new RaiAcceptError("RaiAccept is not configured");
  const now = Date.now();

  // Refresh first (no password sent) while the refresh token is valid.
  if (tokens?.refresh && tokens.user === config.username && tokens.refreshUntil > now + 30_000) {
    const res = await postJson(`${config.authUrl}/refresh`, { refreshToken: tokens.refresh, integrationContext: INTEGRATION });
    if (res.ok) {
      const data = loginSchema.parse(await res.json());
      tokens = { ...tokens, access: data.accessToken, accessUntil: now + data.accessTokenExpiresIn * 1000 };
      return tokens.access;
    }
  }

  const res = await postJson(`${config.authUrl}/login`, {
    username: config.username,
    password: config.password,
    integrationContext: INTEGRATION,
  });
  if (!res.ok) throw new RaiAcceptError(`login failed: ${await readError(res)}`, res.status);
  const data = loginSchema.parse(await res.json());
  tokens = {
    user: config.username,
    access: data.accessToken,
    accessUntil: now + data.accessTokenExpiresIn * 1000,
    refresh: data.refreshToken,
    refreshUntil: now + (data.refreshTokenExpiresIn ?? 0) * 1000,
  };
  return tokens.access;
}

/** A valid access token (cached until 30 s before it expires; concurrent callers share one login). */
async function accessToken(): Promise<string> {
  if (tokens && tokens.user === paymentsConfig().username && tokens.accessUntil > Date.now() + 30_000) return tokens.access;
  pending ??= login().finally(() => {
    pending = null;
  });
  return pending;
}

async function call<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const { apiUrl } = paymentsConfig();
  const send = async (token: string) =>
    method === "GET"
      ? fetch(`${apiUrl}${path}`, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT, Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        })
      : postJson(`${apiUrl}${path}`, body, token);

  let res = await send(await accessToken());
  if (res.status === 401) {
    tokens = null; // expired early or revoked: log in again once
    res = await send(await accessToken());
  }
  if (!res.ok) throw new RaiAcceptError(`${method} ${path.replace(/[A-Z]-\d{3}-[A-Z]+-[\w-]+/g, ":id")} failed: ${await readError(res)}`, res.status);
  const json = await res.json().catch(() => {
    throw new RaiAcceptError(`${method} ${path}: not JSON`);
  });
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new RaiAcceptError(`${method} ${path}: unexpected answer (${parsed.error.issues[0]?.path.join(".")})`);
  return parsed.data;
}

// ---------- Orders ----------
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);

export type OrderInput = {
  merchantOrderReference: string;
  amount: number;
  currency: "EUR";
  description: string;
  itemDescription: string;
  consumer: { email?: string; ipAddress?: string };
  urls: { successUrl: string; failUrl: string; cancelUrl: string; notificationUrl?: string };
  customerReference?: string;
};

/** The same body is sent to "create order" and "create payment session" (the docs require identical values). */
function orderBody(input: OrderInput) {
  return {
    consumer: input.consumer,
    invoice: {
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      merchantOrderReference: input.merchantOrderReference,
      items: [{ description: input.itemDescription, numberOfItems: 1, price: input.amount }],
    },
    paymentMethodPreference: "CARD",
    urls: input.urls,
    // Lets the buyer save the card in RaiAccept for a faster next purchase (RaiAccept asks for consent).
    ...(input.customerReference ? { recurring: { customerReference: input.customerReference, recurringModel: "ONE_CLICK_CHECKOUT" } } : {}),
  };
}

const createdOrderSchema = z.object({ orderIdentification: id, isProduction: z.boolean().optional() }).passthrough();
const sessionSchema = z.object({ sessionId: z.string().min(1).optional(), paymentRedirectURL: z.string().url() }).passthrough();

export async function createOrder(input: OrderInput) {
  return call("POST", "/orders", createdOrderSchema, orderBody(input));
}

export async function createPaymentSession(orderId: string, input: OrderInput) {
  return call("POST", `/orders/${encodeURIComponent(orderId)}/checkout`, sessionSchema, orderBody(input));
}

export const ORDER_STATUSES = ["DRAFT", "CHECKOUT", "PAID", "PARTIALLY_REFUNDED", "FULLY_REFUNDED", "FAILED", "CANCELED", "ABANDONED"] as const;
const orderSchema = z
  .object({
    orderIdentification: id,
    status: z.enum(ORDER_STATUSES),
    isProduction: z.boolean(),
    invoice: z
      .object({ merchantOrderReference: z.string(), amount: z.coerce.number(), currency: z.string().length(3) })
      .passthrough(),
  })
  .passthrough();
export type RaiAcceptOrder = z.infer<typeof orderSchema>;

/** The authoritative order status (what we settle on, never the webhook body). */
export async function getOrder(orderId: string) {
  return call("GET", `/orders/${encodeURIComponent(orderId)}`, orderSchema);
}

const transactionSchema = z
  .object({
    transactionId: id,
    transactionAmount: z.coerce.number().optional(),
    transactionType: z.string().optional(),
    status: z.string().optional(),
    statusCode: z.string().optional(),
  })
  .passthrough();
export type RaiAcceptTransaction = z.infer<typeof transactionSchema>;
// Documented as a single object in the example; accept a list or a wrapped list too.
const transactionsSchema = z.union([
  z.array(transactionSchema),
  z.object({ transactions: z.array(transactionSchema) }).transform((v) => v.transactions),
  transactionSchema.transform((v) => [v]),
]);

export async function getOrderTransactions(orderId: string): Promise<RaiAcceptTransaction[]> {
  return call("POST", `/orders/${encodeURIComponent(orderId)}/transactions`, transactionsSchema);
}

const refundSchema = z.object({ transactionId: id }).passthrough();

export async function refundTransaction(orderId: string, transactionId: string, amount: number, currency: string) {
  return call(
    "POST",
    `/orders/${encodeURIComponent(orderId)}/transactions/${encodeURIComponent(transactionId)}/refund`,
    refundSchema,
    { amount, currency },
  );
}

/** Admin → System check: are the credentials accepted? (Logs in; no order is created.) */
export async function testCredentials(): Promise<void> {
  tokens = null;
  await accessToken();
}
