import React, { useEffect, useState, useRef } from "react";
import { money, type Order } from "../../packages/contracts";
import ActivityDesk from './ActivityDesk';
import InventoryDesk from './InventoryDesk';
import OrderDetails from './OrderDetails';
import {LatestTask} from './latest';
import { api,ApiFailure,setAdminCapability } from "./api";

export default function OrderDesk() {
  const [locked,setLocked]=useState(false);const [token,setToken]=useState("");
  const [section,setSection]=useState("orders");
  const [query,setQuery]=useState('');const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [after,setAfter]=useState('');const [nextCursor,setNextCursor]=useState<string|null>(null);const [total,setTotal]=useState(0);
  const [stats,setStats]=useState({orders:0,byStatus:{placed:0,fulfilled:0,cancelled:0},activeTotalCents:0});
  const [selected,setSelected]=useState<string|null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy,setBusy]=useState<Set<string>>(new Set());
  const listRequest=useRef(new LatestTask());
  async function refresh() {
    setLoading(true);
    setError("");
    const params=new URLSearchParams({limit:'5'});if(search)params.set('q',search);if(status)params.set('status',status);if(after)params.set('after',after);
    await listRequest.current.run(signal=>Promise.all([api<{orders:Order[];total:number;nextCursor:string|null}>(`/api/orders?${params}`,{signal}),api<typeof stats>('/api/stats',{signal})]),([data,global])=>{setLocked(false);setOrders(data.orders);setTotal(data.total);setNextCursor(data.nextCursor);setStats(global);},error=>{setLocked(error instanceof ApiFailure&&error.status===401);setError((error as Error).message);},()=>setLoading(false));
  }
  useEffect(() => {
    setSelected(null);void refresh();return()=>listRequest.current.cancel();
  }, [search,status,after]);
  function applyOrder(order:Order){
    const previous=orders.find(value=>value.id===order.id);
    setOrders(values=>values.flatMap(value=>value.id===order.id?(!status||order.status===status?[order]:[]):[value]));
    if(previous&&previous.status!==order.status){setStats(value=>({...value,activeTotalCents:order.status==='cancelled'?Math.max(0,value.activeTotalCents-order.totalCents):value.activeTotalCents,byStatus:{...value.byStatus,[previous.status]:Math.max(0,value.byStatus[previous.status]-1),[order.status]:value.byStatus[order.status]+1}}));if(status&&order.status!==status)setTotal(value=>Math.max(0,value-1));}
  }
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
      applyOrder(order);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(previous=>{const next=new Set(previous);next.delete(id);return next;});
    }
  }
  if(locked)return <section className="page-section"><h1>Unlock the order desk.</h1><p>The operator has enabled a local capability for administrative access.</p>{error&&<p role="alert">{error}</p>}<form onSubmit={event=>{event.preventDefault();setAdminCapability(token);setToken('');void refresh();}}><label>Admin capability <input type="password" autoComplete="off" value={token} onChange={event=>setToken(event.target.value)} required/></label><button className="button" disabled={loading}>Unlock order desk</button></form></section>;
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
      <div role="group" aria-label="Order desk sections"><button className="text-button" aria-pressed={section==='orders'} onClick={()=>setSection('orders')}>Orders</button><button className="text-button" aria-pressed={section==='inventory'} onClick={()=>setSection('inventory')}>Inventory</button><button className="text-button" aria-pressed={section==='activity'} onClick={()=>setSection('activity')}>Activity</button></div>
      {section==='activity'?<ActivityDesk/>:section==='inventory'?<InventoryDesk/>:<>
      <form className="collection-toolbar" onSubmit={event=>{event.preventDefault();setAfter('');setSearch(query.trim());}}><label>Customer search <input value={query} maxLength={60} onChange={event=>setQuery(event.target.value)}/></label><label>Status <select value={status} disabled={busy.size>0} onChange={event=>{setAfter('');setStatus(event.target.value);}}><option value="">All statuses</option><option value="placed">Placed</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></label><button className="button secondary" disabled={busy.size>0}>Apply filters</button></form>
      <p role="status">{total} matching orders</p><div><button className="text-button" disabled={!after||loading||busy.size>0} onClick={()=>setAfter('')}>First page</button><button className="text-button" disabled={!nextCursor||loading||busy.size>0} onClick={()=>setAfter(nextCursor!)}>Next page</button></div>
      <div className="desk-stats">
        <div>
          <span>Orders placed</span>
          <strong data-testid="global-orders">{stats.orders}</strong>
        </div>
        <div>
          <span>Awaiting fulfillment</span>
          <strong>
            {stats.byStatus.placed}
          </strong>
        </div>
        <div>
          <span>Demo order value</span>
          <strong>
            {money(stats.activeTotalCents)}
          </strong>
        </div>
      </div>
      {selected&&<OrderDetails key={selected} id={selected} onClose={()=>setSelected(null)} onUpdated={applyOrder}/>}
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
      </>}
    </section>
  );
}
