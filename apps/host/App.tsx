import {checkoutIntent} from './checkout';
import {storage} from './storage';
import {normalizeCart,serializeCart,updateCart} from '../../packages/cart';
import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  type CartItem,
  type CheckoutRequest,
  type Order,
  type Product,
  type Shipping,
  money,
  shippingCents,
} from "../../packages/contracts";
import { Artwork } from "../../packages/ui/Artwork";
import { api } from "./api";
import { RemoteBoundary } from "./RemoteBoundary";
import OrderDesk from "./OrderDesk";

const Catalog = lazy(() => import("catalog/Catalog"));
const Cart = lazy(() => import("cart/Cart"));
type View = "shop" | "bag" | "checkout" | "confirmation" | "admin";
function readCart(): CartItem[] {
 try { const raw=storage.get('bag')||'[]';return raw.length<=64000?normalizeCart(JSON.parse(raw)):[]; } catch { return []; }
}
function Recovery({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className="recovery" role="alert">
      <span className="eyebrow">A SMALL INTERRUPTION</span>
      <h2>{title}</h2>
      <p>{children}</p>
      <button className="button" onClick={onAction}>
        {action} <span aria-hidden="true">↻</span>
      </button>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    storage.get("view") === "bag" ? "bag" : "shop",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [name, setName] = useState("Alex Demo");
  const [shipping, setShipping] = useState<Shipping>("standard");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (products.find((p) => p.id === item.productId)?.priceCents || 0) *
        item.quantity,
    0,
  );
  const delivery = shippingCents(shipping, subtotal);
  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const data=await api<{products:Product[]}>('/api/products');
      setProducts(data.products);
      setItems(previous=>normalizeCart(previous,data.products));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadProducts();
  }, []);
  useEffect(() => {
    storage.set("bag", serializeCart(items));
  }, [items]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  function navigate(next: View) {
    if (placing && next !== "confirmation") return;
    setView(next);
    storage.set("view", next === "bag" ? "bag" : "shop");
    setCheckoutError("");
    window.scrollTo({ top: 0 });
  }
  function add(product: Product) {
    const existing = items.find((item) => item.productId === product.id);
    if ((existing?.quantity || 0) >= Math.min(product.stock, 10)) {
      setToast("That is all we have available for this bag.");
      return;
    }
    setItems(previous=>updateCart(previous,{type:'add',productId:product.id},products));
    setToast(`${product.name} added to your bag.`);
  }
  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    if (placing || items.length === 0) return;
    setPlacing(true);
    setCheckoutError("");
    const payload: CheckoutRequest = {
      items,
      customerName: name.trim(),
      shipping,
    };
    try {
      const {key,fingerprint}=checkoutIntent(payload,storage.get('checkout'),()=>crypto.randomUUID());
      storage.set('checkout',JSON.stringify({key,fingerprint,payload}));
      const result = await api<{ order: Order }>("/api/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: fingerprint,
      });
      setOrder(result.order);
      setItems([]);
      storage.set("checkout", "null");
      navigate("confirmation");
      void loadProducts();
    } catch (error) {
      setCheckoutError((error as Error).message);
    } finally {
      setPlacing(false);
    }
  }
  const catalogFallback = (
    <Recovery
      title="The collection is taking a moment."
      action="Reload collection"
      onAction={() => window.location.reload()}
    >
      The shop display could not load. You can still open your saved bag or
      visit the order desk.
    </Recovery>
  );
  const cartFallback = (
    <Recovery
      title="Your bag is saved."
      action="Reload bag"
      onAction={() => window.location.reload()}
    >
      {count} {count === 1 ? "item" : "items"} · {money(subtotal)}
      <br />
      We could not load the bag editor. Reload when the connection returns.
    </Recovery>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        <span>Thoughtful goods. Everyday company.</span>
        <span>Free standard delivery on orders $75+</span>
      </div>
      <header className="site-header">
        <button
          className="brand"
          disabled={placing}
          onClick={() => navigate("shop")}
          aria-label="Fieldwork Supply home"
        >
          <span className="brand-mark" aria-hidden="true">
            ✳
          </span>
          <span>
            fieldwork<span className="brand-sub">SUPPLY & GOOD COMPANY</span>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={view === "shop" ? "nav-active" : ""}
            disabled={placing}
            onClick={() => navigate("shop")}
          >
            Shop
          </button>
          <button
            className={view === "admin" ? "nav-active" : ""}
            disabled={placing}
            onClick={() => navigate("admin")}
          >
            Order desk
          </button>
        </nav>
        <button
          className="bag-button"
          disabled={placing}
          onClick={() => navigate("bag")}
        >
          Bag ({count}) <span aria-hidden="true">↗</span>
        </button>
      </header>
      <main id="main">
        {view === "shop" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <i /> OBJECTS WITH A LITTLE MORE PURPOSE
                </span>
                <h1>
                  Good things,
                  <br />
                  for everyday.
                </h1>
                <p>
                  For the desk, the day out, and all the little moments in
                  between. Considered essentials for a life well lived.
                </p>
                <a className="button" href="#collection">
                  Explore the collection <span aria-hidden="true">↘</span>
                </a>
                <div className="hero-footnote">
                  <span>LESS, BUT BETTER.</span>
                  <span>THE FIELDWORK WAY — NO. 01</span>
                </div>
              </div>
              <div className="hero-scene">
                <div className="scene-ring" />
                <span className="scene-caption">
                  A FRESH PAGE.
                  <br />A GOOD PLACE TO START.
                </span>
                <Artwork kind="notebook" hero />
                <div className="hero-pencil" />
                <div className="round-label">
                  GOOD
                  <br />
                  <em>by nature</em>
                  <br />
                  COMPANY
                </div>
                <span className="scene-bottom">
                  THE EVERYDAY NOTEBOOK · $24
                </span>
              </div>
            </section>
            <div className="values-strip">
              <span>Designed for daily rituals</span>
              <i>✳</i>
              <span>A few things, done thoughtfully</span>
              <i>✳</i>
              <span>Made to make your day</span>
            </div>
            {error ? (
              <Recovery
                title="The shop is taking a moment."
                action="Try again"
                onAction={() => void loadProducts()}
              >
                {error}
              </Recovery>
            ) : loading ? (
              <div className="loading" role="status">
                Getting the good things ready…
              </div>
            ) : (
              <RemoteBoundary fallback={catalogFallback}>
                <Suspense
                  fallback={
                    <div className="loading" role="status">
                      Opening the collection…
                    </div>
                  }
                >
                  <Catalog products={products} onAdd={add} />
                </Suspense>
              </RemoteBoundary>
            )}
            <section className="closing-note">
              <span className="eyebrow">OUR SORT OF THING</span>
              <h2>
                Not more stuff.
                <br />
                <em>More of the good stuff.</em>
              </h2>
              <p>
                We believe the things you reach for every day deserve a little
                extra thought. Simple, useful, quietly lovely.
              </p>
              <span className="signature">The Fieldwork desk</span>
            </section>
          </>
        )}
        {view === "bag" &&
          (loading ? (
            <div className="loading" role="status">
              Getting your bag ready…
            </div>
          ) : error ? (
            <Recovery
              title="Your bag is saved."
              action="Try again"
              onAction={() => void loadProducts()}
            >
              {error}
            </Recovery>
          ) : (
            <RemoteBoundary fallback={cartFallback}>
              <Suspense
                fallback={
                  <div className="loading" role="status">
                    Opening your bag…
                  </div>
                }
              >
                <Cart
                  items={items}
                  products={products}
                  onQuantity={(productId,quantity)=>setItems(previous=>updateCart(previous,{type:'quantity',productId,quantity},products))}
                  onCheckout={() => navigate("checkout")}
                />
              </Suspense>
            </RemoteBoundary>
          ))}
        {view === "checkout" && (
          <section className="page-section">
            <button
              className="text-button"
              disabled={placing}
              onClick={() => navigate("bag")}
            >
              ← Back to your bag
            </button>
            <span className="eyebrow block">ONE LAST LITTLE THING</span>
            <h1>Make it a good day.</h1>
            <div className="checkout-layout">
              <form
                onSubmit={(event) => void placeOrder(event)}
                className="checkout-form"
                aria-busy={placing}
              >
                <h2>A place for your good finds.</h2>
                <p>
                  This is a demo. Use a made-up name; no address or payment
                  details are needed.
                </p>
                <label htmlFor="demo-name">Demo name</label>
                <input
                  id="demo-name"
                  disabled={placing}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={60}
                  autoComplete="off"
                />
                <fieldset disabled={placing}>
                  <legend>Delivery</legend>
                  <label className="delivery-option">
                    <input
                      type="radio"
                      name="shipping"
                      checked={shipping === "standard"}
                      onChange={() => setShipping("standard")}
                    />
                    <span>
                      Take it easy<small>Standard · 3–5 imaginary days</small>
                    </span>
                    <strong>{subtotal >= 7500 ? "Free" : "$6.00"}</strong>
                  </label>
                  <label className="delivery-option">
                    <input
                      type="radio"
                      name="shipping"
                      checked={shipping === "express"}
                      onChange={() => setShipping("express")}
                    />
                    <span>
                      A little sooner<small>Express · 1–2 imaginary days</small>
                    </span>
                    <strong>$12.00</strong>
                  </label>
                </fieldset>
                {checkoutError && (
                  <div role="alert" className="notice">
                    {checkoutError}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        navigate("bag");
                        void loadProducts();
                      }}
                    >
                      Review bag & refresh stock
                    </button>
                  </div>
                )}
                <button
                  className="button wide"
                  type="submit"
                  disabled={placing || items.length === 0 || !name.trim()}
                >
                  {placing ? "Placing your demo order…" : "Place demo order"}
                  <span aria-hidden="true">↗</span>
                </button>
                <span className="fine-print">
                  No payment. No shipment. Just a working example.
                </span>
              </form>
              <aside className="summary-card">
                <span className="eyebrow">COMING ALONG WITH YOU</span>
                <h2>Your good finds</h2>
                {items.map((item) => (
                  <div className="summary-row" key={item.productId}>
                    <span>
                      {item.quantity} ×{" "}
                      {products.find((p) => p.id === item.productId)?.name}
                    </span>
                    <strong>
                      {money(
                        item.quantity *
                          (products.find((p) => p.id === item.productId)
                            ?.priceCents || 0),
                      )}
                    </strong>
                  </div>
                ))}
                <div className="summary-row">
                  <span>Delivery</span>
                  <strong>{delivery === 0 ? "Free" : money(delivery)}</strong>
                </div>
                <div className="summary-row total">
                  <span>Total</span>
                  <strong data-testid="checkout-total">
                    {money(subtotal + delivery)}
                  </strong>
                </div>
                <p>
                  The server checks prices and availability when you place the
                  order.
                </p>
              </aside>
            </div>
          </section>
        )}
        {view === "confirmation" && order && (
          <section className="confirmation">
            <span className="confirmation-stamp" aria-hidden="true">
              ✓
            </span>
            <span className="eyebrow">
              ALL SET, {order.customerName.toUpperCase()}
            </span>
            <h1>A good day for good things.</h1>
            <p>
              Your demo order is in. You can find it waiting at the order desk.
            </p>
            <div className="receipt">
              <span>ORDER REFERENCE</span>
              <strong data-testid="order-id">{order.id}</strong>
              <span>
                {order.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                items · {money(order.totalCents)} · No payment taken
              </span>
            </div>
            <button className="button" onClick={() => navigate("shop")}>
              Back to the good things <span aria-hidden="true">↗</span>
            </button>
          </section>
        )}
        {view === "admin" && <OrderDesk />}
      </main>
      <footer>
        <div>
          <span className="footer-brand">fieldwork.</span>
          <p>
            A little more thought.
            <br />A little better, every day.
          </p>
        </div>
        <div>
          <span className="eyebrow">THE SMALL PRINT</span>
          <p>
            A synthetic storefront for exploring better software.
            <br />
            All products and orders are demonstration data.
          </p>
          <span>Good company, every day.</span>
        </div>
      </footer>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        {toast}
      </div>
    </>
  );
}
