import React,{useRef,useState,useEffect} from "react";
import { money, deliveryProgress, type CartProps } from "../../packages/contracts";
import { Artwork } from "../../packages/ui/Artwork";

export default function Cart({
  items,
  products,
  onQuantity,
  onCheckout,
  onClear,
}: CartProps) {
  const [confirm,setConfirm]=useState(false);const dialog=useRef<HTMLDialogElement>(null);const clearButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(confirm)dialog.current?.showModal();},[confirm]);
  const close=()=>{dialog.current?.close();setConfirm(false);clearButton.current?.focus();};
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
      {confirm&&<dialog ref={dialog} aria-labelledby="clear-title" onCancel={event=>{event.preventDefault();close();}}><h2 id="clear-title">Empty your bag?</h2><p>All selected finds will be removed.</p><button className="button secondary" onClick={close}>Keep my finds</button><button className="button" onClick={()=>{onClear?.();close();}}>Yes, empty bag</button></dialog>}
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
            {onClear&&<button ref={clearButton} className="text-button" onClick={()=>setConfirm(true)}>Empty bag</button>}
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <p>{deliveryProgress(subtotal).remainingCents?`${money(deliveryProgress(subtotal).remainingCents)} away from free standard delivery.`:'Your bag qualifies for free standard delivery.'}</p>
            <progress aria-label="Progress toward free standard delivery" max={100} value={deliveryProgress(subtotal).percent}/><p className="fine-print">Express delivery remains $12.</p>
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
