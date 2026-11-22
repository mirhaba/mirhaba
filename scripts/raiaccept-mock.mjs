#!/usr/bin/env node
// Local stand-in for RaiAccept (auth, orders, payment sessions, transactions, refunds, a fake payment
// page and notification webhooks), following https://docs.raiaccept.com/code-integration.html.
// For development and the payment tests only; the app refuses these URL overrides on Vercel production.
//
//   node scripts/raiaccept-mock.mjs            # http://127.0.0.1:4010
//   .env.local:
//     RAIACCEPT_USERNAME=mock-user  RAIACCEPT_PASSWORD=mock-pass  RAIACCEPT_MODE=sandbox
//     RAIACCEPT_AUTH_URL=http://127.0.0.1:4010/auth/api
//     RAIACCEPT_API_URL=http://127.0.0.1:4010
//     RAIACCEPT_PAYMENT_ORIGIN=http://127.0.0.1:4010
//     RAIACCEPT_WEBHOOK_SECRET=<32+ random characters>
//
// Test controls: POST /__mock/config {"isProduction":true} · POST /__mock/tamper {"order":"…","amount":0.01}
//                GET /__mock/state · POST /__mock/reset
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const USER = process.env.MOCK_USERNAME ?? "mock-user";
const PASS = process.env.MOCK_PASSWORD ?? "mock-pass";

let state;
const reset = () => {
  state = { isProduction: false, tokens: new Map(), orders: new Map(), sessions: new Map(), webhooks: [], logins: 0, webhookFailFirst: 0 };
};
reset();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
const fail = (res, status, message, fieldName) => send(res, status, { errors: [{ fieldName: fieldName ?? "", message, rejectedValue: "" }], traceId: randomUUID() });

function authed(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
  const t = m && state.tokens.get(m[1]);
  return !!t && t > Date.now();
}

function validateOrder(body) {
  const inv = body?.invoice;
  if (!inv) return "invoice required";
  if (!(typeof inv.amount === "number" && inv.amount >= 0)) return "invoice.amount";
  if (!/^[A-Z]{3}$/.test(inv.currency ?? "")) return "invoice.currency";
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(inv.merchantOrderReference ?? "")) return "invoice.merchantOrderReference";
  if (!["CARD", "GOOGLE_PAY", "APPLE_PAY"].includes(body.paymentMethodPreference)) return "paymentMethodPreference";
  for (const k of ["successUrl", "failUrl", "cancelUrl"]) if (!body.urls?.[k]) return `urls.${k}`;
  if (body.recurring?.customerReference && !/^[A-Za-z0-9_-]{0,64}$/.test(body.recurring.customerReference)) return "recurring.customerReference";
  return null;
}

const publicOrder = (o) => ({
  orderIdentification: o.id,
  paymentMethodPreference: "CARD",
  merchant: { merchantAccountId: "D-001-MA-MOCK", statementDescriptorShortVersion: "mirhaba" },
  createdOn: o.createdOn,
  consumer: o.body.consumer ?? {},
  invoice: { ...o.body.invoice, amount: o.amount },
  callbackUrls: o.body.urls,
  isProduction: state.isProduction,
  status: o.status,
  recurring: o.body.recurring,
});

async function notify(order, tx) {
  const url = order.body.urls?.notificationUrl;
  if (!url) return;
  const payload = {
    transaction: { ...tx, isProduction: state.isProduction },
    merchant: { merchantAccountId: "D-001-MA-MOCK", statementDescriptorShortVersion: "mirhaba" },
    order: { orderIdentification: order.id, preferredPaymentMethod: "CARD", invoice: order.body.invoice },
    callbackUrls: order.body.urls,
  };
  // First attempt + up to three retries, like RaiAccept.
  for (let attempt = 0; attempt < 4; attempt++) {
    let status = 0;
    try {
      if (state.webhookFailFirst > 0) {
        state.webhookFailFirst--;
        status = 599;
      } else {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        status = r.status;
      }
    } catch {
      status = 0;
    }
    state.webhooks.push({ order: order.id, url, attempt, status });
    if (status >= 200 && status < 300) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

function checkoutPage(session) {
  const o = state.orders.get(session.order);
  return `<!doctype html><meta charset="utf-8"><title>Mock RaiAccept</title>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto">
<h1>Mock RaiAccept payment</h1>
<p id="amount">${o.amount} ${o.body.invoice.currency} · ${o.body.invoice.description ?? ""}</p>
<p>Sandbox: ${!state.isProduction}</p>
<form method="post" action="/checkout/complete">
<input type="hidden" name="session" value="${session.id}">
<button name="outcome" value="success" id="pay-success">Pay (4999 9999 9999 0011)</button>
<button name="outcome" value="decline-2004" id="pay-decline">Insufficient funds (5559 4900 0000 0114)</button>
<button name="outcome" value="decline-3005" id="pay-cvv">Wrong CVV</button>
<button name="outcome" value="cancel" id="pay-cancel">Cancel (X)</button>
</form></body>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const raw = req.method === "POST" ? await readBody(req) : "";
  let body = null;
  try {
    body = raw && req.headers["content-type"]?.includes("json") ? JSON.parse(raw) : null;
  } catch {
    return fail(res, 400, "HTTP request message reading failed");
  }
  const path = url.pathname;

  // ---------- test controls ----------
  if (path === "/__mock/reset") return reset(), send(res, 200, { ok: true });
  if (path === "/__mock/state")
    return send(res, 200, { isProduction: state.isProduction, logins: state.logins, orders: [...state.orders.values()].map((o) => ({ id: o.id, status: o.status, amount: o.amount, ref: o.body.invoice.merchantOrderReference, txs: o.txs })), webhooks: state.webhooks });
  if (path === "/__mock/config") return Object.assign(state, body ?? {}), send(res, 200, { ok: true });
  if (path === "/__mock/tamper") {
    const o = state.orders.get(body?.order);
    if (!o) return send(res, 404, {});
    o.amount = body.amount;
    return send(res, 200, { ok: true });
  }

  // ---------- auth ----------
  if (path === "/auth/api/login" && req.method === "POST") {
    if (!req.headers["user-agent"]) return send(res, 403, "Request blocked.");
    if (body?.integrationContext?.type !== "CODE") return fail(res, 400, "integrationContext required");
    if (body.username !== USER || body.password !== PASS) return send(res, 401, { code: "AUTH_INVALID_CREDENTIALS", message: "Invalid credentials" });
    state.logins++;
    const access = `mock-at-${randomUUID()}`;
    state.tokens.set(access, Date.now() + 299_000);
    return send(res, 200, { accessToken: access, accessTokenExpiresIn: 299, refreshToken: `mock-rt-${randomUUID()}`, refreshTokenExpiresIn: 86399 });
  }
  if (path === "/auth/api/refresh" && req.method === "POST") {
    const access = `mock-at-${randomUUID()}`;
    state.tokens.set(access, Date.now() + 299_000);
    return send(res, 200, { accessToken: access, accessTokenExpiresIn: 299 });
  }

  // ---------- payment page ----------
  if (path === "/checkout" && req.method === "GET") {
    const s = state.sessions.get(url.searchParams.get("paymentSession"));
    if (!s) return send(res, 404, { error: "session" });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(checkoutPage(s));
  }
  if (path === "/checkout/complete" && req.method === "POST") {
    const form = new URLSearchParams(raw);
    const s = state.sessions.get(form.get("session"));
    if (!s) return send(res, 404, {});
    const o = state.orders.get(s.order);
    const outcome = form.get("outcome");
    let redirect = o.body.urls.cancelUrl;
    if (outcome === "cancel") {
      o.status = "CANCELED";
    } else {
      const ok = outcome === "success";
      const code = ok ? "0000" : outcome.split("-")[1];
      const tx = {
        transactionId: `D-001-TX-${randomUUID()}`,
        transactionAmount: o.amount,
        transactionCurrency: o.body.invoice.currency,
        transactionType: "PURCHASE",
        paymentMethod: "CARD",
        status: ok ? "SUCCESS" : "FAILED",
        statusCode: code,
        statusMessage: ok ? "Success" : "Fail",
        createdOn: new Date().toISOString(),
        updatedOn: new Date().toISOString(),
      };
      o.txs.push(tx);
      o.status = ok ? "PAID" : "FAILED";
      redirect = ok ? o.body.urls.successUrl : o.body.urls.failUrl;
      await notify(o, tx);
    }
    res.writeHead(302, { Location: redirect });
    return res.end();
  }

  // ---------- trapi ----------
  if (!authed(req)) return fail(res, 401, "Authentication error");
  const m = /^\/orders(?:\/([^/]+))?(?:\/(checkout|transactions))?(?:\/([^/]+))?(?:\/(refund))?$/.exec(path);
  if (!m) return fail(res, 404, "not found");
  const [, orderId, sub, txId, refund] = m;

  if (!orderId && req.method === "POST") {
    if (!req.headers["content-type"]?.includes("application/json")) return fail(res, 415, "HTTP media type for request payload is not supported");
    const err = validateOrder(body);
    if (err) return fail(res, 400, "validation failed", err);
    if ([...state.orders.values()].some((o) => o.body.invoice.merchantOrderReference === body.invoice.merchantOrderReference))
      return fail(res, 409, "duplicate merchantOrderReference");
    const o = { id: `D-001-ORD-${randomUUID()}`, body, amount: body.invoice.amount, status: "DRAFT", txs: [], createdOn: new Date().toISOString() };
    state.orders.set(o.id, o);
    return send(res, 201, publicOrder(o));
  }
  const o = state.orders.get(orderId);
  if (!o) return fail(res, 404, "object not found");

  if (sub === "checkout" && req.method === "POST") {
    const err = validateOrder(body);
    if (err) return fail(res, 400, "validation failed", err);
    if (body.invoice.amount !== o.body.invoice.amount || body.invoice.merchantOrderReference !== o.body.invoice.merchantOrderReference)
      return fail(res, 400, "parameters differ from the order");
    const s = { id: `D-001-SESS-${randomUUID()}`, order: o.id };
    state.sessions.set(s.id, s);
    o.status = "CHECKOUT";
    return send(res, 201, { sessionId: s.id, paymentRedirectURL: `${ORIGIN}/checkout?paymentSession=${s.id}` });
  }
  if (!sub && req.method === "GET") return send(res, 200, publicOrder(o));
  // Like the live API: GET works, POST (what the docs say) is 405.
  if (sub === "transactions" && !txId && req.method === "POST") return fail(res, 405, "HTTP request method is not supported.");
  if (sub === "transactions" && !txId && req.method === "GET") return send(res, 200, o.txs.map((t) => ({ ...t, isProduction: state.isProduction })));
  if (sub === "transactions" && txId && refund && req.method === "POST") {
    const tx = o.txs.find((t) => t.transactionId === txId && t.status === "SUCCESS" && t.transactionType === "PURCHASE");
    if (!tx) return fail(res, 404, "transaction not found");
    const refunded = o.txs.filter((t) => t.transactionType === "REFUND").reduce((a, t) => a + t.transactionAmount, 0);
    if (!(body?.amount > 0) || body.amount + refunded > tx.transactionAmount + 1e-9) return fail(res, 400, "The credited amount exceeds the amount of the referenced debit transaction.");
    if (body.currency !== tx.transactionCurrency) return fail(res, 400, "currency");
    const rtx = { ...tx, transactionId: `D-001-TX-${randomUUID()}`, transactionType: "REFUND", transactionAmount: body.amount, createdOn: new Date().toISOString() };
    o.txs.push(rtx);
    o.status = body.amount + refunded >= tx.transactionAmount ? "FULLY_REFUNDED" : "PARTIALLY_REFUNDED";
    void notify(o, rtx);
    return send(res, 200, { transactionId: rtx.transactionId });
  }
  if (sub === "transactions" && txId && req.method === "GET") {
    const tx = o.txs.find((t) => t.transactionId === txId);
    return tx ? send(res, 200, { transaction: tx, order: { orderIdentification: o.id, invoice: o.body.invoice } }) : fail(res, 404, "not found");
  }
  return fail(res, 405, "Method not allowed");
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock RaiAccept on ${ORIGIN}`));
