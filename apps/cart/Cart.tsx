import React from "react";
import { money, type CartProps } from "../../packages/contracts";
import { Artwork } from "../../packages/ui/Artwork";

export default function Cart({
  items,
  products,
  onQuantity,
  onCheckout,
}: CartProps) {
  const lines = items.flatMap((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product ? [{ item, product }] : [];
  });
  const subtotal = lines.reduce(
    (sum, { item, product }) => sum + item.quantity * product.priceCents,
    0,
  );
  return (
    <section className="page-section" aria-labelledby="bag-title">
      <span className="eyebrow">A FEW GOOD FINDS</span>
      <h1 id="bag-title">Your everyday, upgraded.</h1>
      {lines.length === 0 ? (
        <div className="empty-state">
          <h2>Your next everyday favorite is waiting.</h2>
          <p>
            Your bag is empty. Head back to the shop to find something useful.
          </p>
        </div>
      ) : (
        <div className="bag-layout">
          <div className="bag-lines">
            {lines.map(({ item, product }) => (
              <article className="bag-line" key={product.id}>
                <div
                  className="bag-art"
                  style={{ backgroundColor: product.color }}
                >
                  <Artwork kind={product.artwork} />
                </div>
                <div className="bag-description">
                  <span className="eyebrow">{product.category}</span>
                  <h2>{product.name}</h2>
                  <p>{money(product.priceCents)} each</p>
                  <button
                    className="text-button"
                    aria-label={`Remove ${product.name}`}
                    onClick={() => onQuantity(product.id, 0)}
                  >
                    Remove
                  </button>
                </div>
                <div className="quantity">
                  <label htmlFor={`quantity-${product.id}`}>
                    Quantity<span className="sr-only"> for {product.name}</span>
                  </label>
                  <select
                    id={`quantity-${product.id}`}
                    value={item.quantity}
                    onChange={(event) =>
                      onQuantity(product.id, Number(event.target.value))
                    }
                  >
                    {item.quantity>product.stock && <option value={item.quantity} disabled>{item.quantity} (unavailable)</option>}
                    {Array.from({ length: Math.min(10,product.stock) }, (_, i) => i + 1).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                  <strong>{money(product.priceCents * item.quantity)}</strong>
                  {item.quantity > product.stock && (
                    <span className="line-warning">
                      Only {product.stock} left
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
          <aside className="summary-card">
            <span className="eyebrow">THE LITTLE DETAILS</span>
            <h2>Bag summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <p>
              Standard delivery is on us from $75. Delivery is calculated at
              checkout.
            </p>
            <button className="button wide" disabled={lines.some(({item,product})=>item.quantity>product.stock)} onClick={onCheckout}>
              Continue to checkout <span aria-hidden="true">↗</span>
            </button>
            <span className="fine-print">
              A synthetic shop. No payment needed.
            </span>
          </aside>
        </div>
      )}
    </section>
  );
}
