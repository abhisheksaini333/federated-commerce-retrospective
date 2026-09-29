import React, { useEffect, useState } from "react";
import { money, type Order } from "../../packages/contracts";
import { api } from "./api";

export default function OrderDesk() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setOrders((await api<{ orders: Order[] }>("/api/orders")).orders);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function fulfill(id: string) {
    setBusy(id);
    setError("");
    try {
      const { order } = await api<{ order: Order }>(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "fulfilled" }),
      });
      setOrders((previous) =>
        previous.map((value) => (value.id === id ? order : value)),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy("");
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
          disabled={loading}
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
        <div className="table-scroll">
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
                    <strong>{order.id}</strong>
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
                        disabled={busy === order.id}
                      >
                        {busy === order.id ? "Updating…" : "Mark fulfilled"}
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
