import React, { useEffect, useState, useRef } from "react";
import { money, type Order } from "../../packages/contracts";
import OrderDetails from './OrderDetails';
import {LatestTask} from './latest';
import { api } from "./api";

export default function OrderDesk() {
  const [selected,setSelected]=useState<string|null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy,setBusy]=useState<Set<string>>(new Set());
  const listRequest=useRef(new LatestTask());
  async function refresh() {
    setLoading(true);
    setError("");
    await listRequest.current.run(signal=>api<{orders:Order[]}>('/api/orders',{signal}),data=>setOrders(data.orders),error=>setError((error as Error).message),()=>setLoading(false));
  }
  useEffect(() => {
    void refresh();return()=>listRequest.current.cancel();
  }, []);
  async function fulfill(id: string) {
    listRequest.current.cancel();setLoading(false);
    setBusy(previous=>new Set(previous).add(id));
    setError("");
    try {
      const { order } = await api<{ order: Order }>(`/api/orders/${id}`, {
        method: "PATCH",
        headers:{"If-Match":`"order-${orders.find(order=>order.id===id)?.version}"`},
        body: JSON.stringify({ status: "fulfilled" }),
      });
      setOrders((previous) =>
        previous.map((value) => (value.id === id ? order : value)),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(previous=>{const next=new Set(previous);next.delete(id);return next;});
    }
  }
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BEHIND THE COUNTER</span>
          <h1>The order desk.</h1>
          <p>
            Synthetic orders for this session. Nothing ships from this demo.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => void refresh()}
          disabled={loading || busy.size>0}
        >
          Refresh orders
        </button>
      </div>
      <div className="desk-stats">
        <div>
          <span>Orders placed</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>Awaiting fulfillment</span>
          <strong>
            {orders.filter((order) => order.status === "placed").length}
          </strong>
        </div>
        <div>
          <span>Demo order value</span>
          <strong>
            {money(orders.reduce((sum, order) => sum + order.totalCents, 0))}
          </strong>
        </div>
      </div>
      {selected&&<OrderDetails key={selected} id={selected} onClose={()=>setSelected(null)} onUpdated={order=>setOrders(previous=>previous.map(value=>value.id===order.id?order:value))}/>}
      {error && (
        <div role="alert" className="notice">
          {error}
          <button className="text-button" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading the order desk…</p>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <h2>A quiet start.</h2>
          <p>Place a demo order in the shop and it will appear here.</p>
        </div>
      ) : (
        <div className="table-scroll" role="region" aria-label="Orders table; scroll horizontally for all columns" tabIndex={0}>
          <table>
            <caption className="sr-only">Synthetic orders</caption>
            <thead>
              <tr>
                <th>Order</th>
                <th>Demo customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <button className="text-button order-reference" aria-label={`View order ${order.id}`} onClick={()=>setSelected(order.id)}>{order.id}</button>
                    <small>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </small>
                  </td>
                  <td>{order.customerName}</td>
                  <td>
                    {order.items
                      .map((item) => `${item.quantity} × ${item.name}`)
                      .join(", ")}
                  </td>
                  <td>{money(order.totalCents)}</td>
                  <td>
                    <span className={`status-pill ${order.status}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    {order.status === "placed" ? (
                      <button
                        className="text-button"
                        onClick={() => void fulfill(order.id)}
                        disabled={busy.has(order.id)}
                      >
                        {busy.has(order.id) ? "Updating…" : "Mark fulfilled"}
                      </button>
                    ) : (
                      <span>Complete</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
