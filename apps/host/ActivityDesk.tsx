import React,{useEffect,useRef,useState} from 'react';import {api} from './api';import {LatestTask} from './latest';
interface AuditEvent {sequence:number;type:string;subjectId:string;at:string;details:Record<string,unknown>}
const labels:Record<string,string>={order_placed:'Order placed',order_cancelled:'Order cancelled',order_fulfilled:'Order fulfilled',stock_adjusted:'Stock adjusted',inventory_counted:'Inventory counted'};
export default function ActivityDesk(){const [events,setEvents]=useState<AuditEvent[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const task=useRef(new LatestTask());
 async function refresh(){setBusy(true);setError('');await task.current.run(signal=>api<{events:AuditEvent[]}>('/api/audit',{signal}),value=>setEvents(value.events),error=>setError((error as Error).message),()=>setBusy(false));}
 useEffect(()=>{void refresh();return()=>task.current.cancel();},[]);
 return <section><h2>Activity</h2><p>Accepted changes for this demo session, newest first.</p><button className="button secondary" disabled={busy} onClick={()=>void refresh()}>Refresh activity</button>{error&&<p role="alert">{error}</p>}{!busy&&!events.length&&<p>No accepted operations yet.</p>}<ol aria-label="Recent accepted operations" className="activity-list">{events.map(event=><li key={event.sequence}><strong>{labels[event.type]??'Operation recorded'}</strong><span className="order-reference">{event.subjectId}</span><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ol></section>;
}
