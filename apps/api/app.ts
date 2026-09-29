import express, { type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { seedProducts } from "./catalog";
import {
  shippingCents,
  type CheckoutRequest,
  type Order,
} from "../../packages/contracts";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

function parseCheckout(value: unknown): CheckoutRequest | null {
  if (
    !object(value) ||
    !exactKeys(value, ["items", "customerName", "shipping"])
  )
    return null;
  if (
    typeof value.customerName !== "string" ||
    !value.customerName.trim() ||
    value.customerName.length > 60
  )
    return null;
  if (value.shipping !== "standard" && value.shipping !== "express")
    return null;
  if (
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 6
  )
    return null;
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!object(item) || !exactKeys(item, ["productId", "quantity"]))
      return null;
    if (
      typeof item.productId !== "string" ||
      !seedProducts.some((p) => p.id === item.productId) ||
      seen.has(item.productId)
    )
      return null;
    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    )
      return null;
    seen.add(item.productId);
  }
  return {
    items: value.items
      .map((item) => ({
        productId: item.productId as string,
        quantity: item.quantity as number,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    customerName: value.customerName.trim(),
    shipping: value.shipping,
  };
}

/** One isolated in-memory store per app; synchronous mutation is atomic in one Node process. */
export function createApp() {
  const app = express();
  const products = seedProducts.map((product) => ({ ...product }));
  const orders = new Map<string, Order>();
  const receipts = new Map<string, { fingerprint: string; order: Order }>();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", mode: "synthetic-local-demo" }),
  );
  app.get("/api/products", (_req, res) => res.json({ products }));
  app.get("/api/orders", (_req, res) =>
    res.json({ orders: [...orders.values()].reverse() }),
  );
  app.post("/api/checkout", (req, res) => {
    const key = req.get("Idempotency-Key");
    const payload = parseCheckout(req.body);
    if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key) || !payload) {
      res.status(400).json({
        code: "INVALID_CHECKOUT",
        error:
          "Use a demo name, valid delivery option, and 1–10 of each item. A valid idempotency key is required.",
      });
      return;
    }
    const fingerprint = JSON.stringify(payload);
    const receipt = receipts.get(key);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        res.status(409).json({
          code: "IDEMPOTENCY_CONFLICT",
          error:
            "This checkout key belongs to a different order. Review the bag and start a new checkout.",
        });
      else res.json({ order: receipt.order, replayed: true });
      return;
    }
    const lines = payload.items.map((item) => ({
      item,
      product: products.find((p) => p.id === item.productId)!,
    }));
    if (lines.some(({ item, product }) => product.stock < item.quantity)) {
      res.status(409).json({
        code: "OUT_OF_STOCK",
        error:
          "Stock changed. Refresh the catalog and adjust your bag before trying again.",
      });
      return;
    }
    // No await between validation and mutation: one process cannot interleave these writes.
    const subtotalCents = lines.reduce(
      (sum, { item, product }) => sum + item.quantity * product.priceCents,
      0,
    );
    const delivery = shippingCents(payload.shipping, subtotalCents);
    const order: Order = {
      id: `FW-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerName: payload.customerName,
      shipping: payload.shipping,
      items: lines.map(({ item, product }) => ({
        ...item,
        name: product.name,
        unitPriceCents: product.priceCents,
      })),
      subtotalCents,
      shippingCents: delivery,
      totalCents: subtotalCents + delivery,
      createdAt: new Date().toISOString(),
      status: "placed",
    };
    for (const { item, product } of lines) product.stock -= item.quantity;
    orders.set(order.id, order);
    receipts.set(key, { fingerprint, order });
    res.status(201).json({ order, replayed: false });
  });
  app.patch("/api/orders/:id", (req, res) => {
    if (
      !object(req.body) ||
      !exactKeys(req.body, ["status"]) ||
      req.body.status !== "fulfilled"
    ) {
      res.status(400).json({
        code: "INVALID_STATUS",
        error: "Only fulfillment is supported by this demo.",
      });
      return;
    }
    const order = orders.get(req.params.id);
    if (!order) {
      res.status(404).json({ code: "NOT_FOUND", error: "Order not found." });
      return;
    }
    order.status = "fulfilled";
    res.json({ order });
  });
  app.use((_req, res) =>
    res.status(404).json({ code: "NOT_FOUND", error: "Route not found." }),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status =
      error.type === "entity.too.large"
        ? 413
        : error.type === "entity.parse.failed"
          ? 400
          : 500;
    res.status(status).json({
      code:
        status === 413
          ? "BODY_TOO_LARGE"
          : status === 400
            ? "INVALID_JSON"
            : "INTERNAL_ERROR",
      error:
        status === 500
          ? "The demo service encountered an error."
          : "Send a valid JSON request smaller than 16 KB.",
    });
  };
  app.use(errors);
  return app;
}
