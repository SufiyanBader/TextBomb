import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

interface Stats { sent:number; delivered:number; read:number; replied:number; failed:number; opted_out:number; delivery_rate:number; read_rate:number; total_campaigns:number; }
interface Campaign { id:string; name:string; status:string; sent_count:number; read_count?:number; total_recipients:number; created_at:string; scheduled_at?:string; MessageTemplate?:{name:string;category:string}; }

const STATUS_COLOR: Record<string,string> = { completed:'var(--green)', sending:'var(--purple)', paused:'var(--yellow)', failed:'var(--red)', scheduled:'var(--teal)', draft:'var(--tx4)' };
const STATUS_CLASS: Record<string,string> = { completed:'b-completed', sending:'b-sending', paused:'b-paused', failed:'b-failed', scheduled:'b-scheduled', draft:'b-draft' };

function buildFunnel(items: {label:string; val:number; color:string}[]) {
  if (!items[0] || items[0].val === 0) return <div className="muted" style={{ padding: '10px 0' }}>No data yet — launch a campaign</div>;
  const max = items[0].val || 1;
  return (
    <div className="funnel">
      {items.map(it => {
        const pct = Math.max(2, Math.round(it.val / max * 100));
        return (
          <div key={it.label} className="funnel-row">
            <div className="funnel-label">{it.label}</div>
            <div className="funnel-bar-wrap">
              <div className="funnel-bar" style={{ width: `${pct}%`, background: it.color }}>
                {pct > 12 && <span className="funnel-bar-pct">{pct}%</span>}
              </div>
            </div>
            <div className="funnel-val">
              <span className="funnel-num">{it.val.toLocaleString()}</span>
              <span className="funnel-pct">{Math.round((it.val / max) * 100)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:9, padding:'8px 12px', fontSize:'0.78rem' }}>
      <div style={{ color:'var(--tx4)', marginBottom:4 }}>{label}</div>
      {payload.map((p: any) => <div key={p.dataKey} style={{ color:p.color, fontWeight:600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

export default function Overview() {
  const { user, isRole } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [chart, setChart] = useState<any[]>([]);
  const [poolNums, setPoolNums] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reqs: Promise<any>[] = [
      api.get('/analytics/overview?days=30'),
      api.get('/campaigns?limit=5'),
    ];
    if (isRole('super_admin')) reqs.push(api.get('/number-pool?filter=all'));

    Promise.all(reqs).then(([s, c, pool]) => {
      setStats(s.data);
      setCampaigns(c.data.campaigns || []);
      if (pool) setPoolNums(pool.data.length || 0);
      setChart(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { day: d.toLocaleDateString('en', { weekday: 'short' }), sent: Math.floor(Math.random() * 200 + 50), read: Math.floor(Math.random() * 120 + 20) };
      }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const SC = ({ label, value, sub, color = 'var(--tx1)', cls = 'bl', icon }: any) => (
    <div className={`sc ${cls}`}>
      <div className="sc-ic">{icon}</div>
      <div className="sc-l">{label}</div>
      {loading ? <div style={{ height: 32, width: '55%', borderRadius: 6, background: 'rgba(255,255,255,.07)', margin: '8px 0 4px', animation: 'pulse 1.5s ease infinite' }} /> : <div className="sc-v" style={{ color }}>{value ?? '—'}</div>}
      {sub && <div className="sc-sub">{sub}</div>}
    </div>
  );

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-t">Dashboard</div>
          <div className="sec-s">Good to see you, {user?.name?.split(' ')[0]}. Last 30 days.</div>
        </div>
        <Link to="/campaigns/new" className="btn bp">+ New Campaign</Link>
      </div>

      {/* KPIs */}
      <div className="sg mb20">
        <SC label="Total Sent" value={stats?.sent?.toLocaleString()} icon="📤" cls="bl" />
        <SC label="Delivered" value={stats?.delivered?.toLocaleString()} sub={`${stats?.delivery_rate ?? 0}% rate`} icon="✅" cls="gr" color="var(--green)" />
        <SC label="Read" value={stats?.read?.toLocaleString()} sub={`${stats?.read_rate ?? 0}% rate`} icon="👁" cls="cy" color="var(--teal)" />
        <SC label="Campaigns" value={stats?.total_campaigns?.toLocaleString()} icon="📨" cls="pu" color="var(--purple)" />
      </div>

      {isRole('super_admin') && (
        <div className="ibox ib" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.1rem' }}>📱</span>
          <span><strong style={{ color: 'var(--teal)' }}>{poolNums}</strong> WhatsApp numbers in your pool. <Link to="/admin/number-pool" style={{ color: 'var(--teal)', fontWeight: 600 }}>Manage Number Pool →</Link></span>
        </div>
      )}

      <div className="g2 mb20">
        {/* Chart */}
        <div className="card">
          <div className="card-h">
            <div className="card-t">Message Activity (7 days)</div>
            <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--tx4)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(108,71,255,.8)', display: 'inline-block' }} /> Sent
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} /> Read
              </span>
            </div>
          </div>
          <div className="card-b">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgba(108,71,255,.8)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="rgba(108,71,255,.8)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--tx4)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--tx4)', fontSize: 11 }} />
                <Tooltip content={<TT />} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="rgba(108,71,255,.8)" strokeWidth={2} fill="url(#gS)" />
                <Area type="monotone" dataKey="read" name="Read" stroke="var(--teal)" strokeWidth={2} fill="url(#gR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <div className="card-t">Recent Campaigns</div>
            <div className="card-sub">Latest 5 campaigns and their current status</div>
          </div>
          <Link to="/campaigns" className="btn bs bsm">View All →</Link>
        </div>
        <div className="twrap">
          <table className="tbl">
            <thead>
              <tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Read</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => (
                <tr key={i}>
                  <td><div style={{ height: 16, width: 120, background: 'var(--bg3)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
                  <td><div style={{ height: 20, width: 60, background: 'var(--bg3)', borderRadius: 10 }} /></td>
                  <td colSpan={4}><div style={{ height: 16, width: '100%', background: 'var(--bg3)', borderRadius: 4 }} /></td>
                </tr>
              )) : campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td><span className={`badge b-${c.status}`}>{c.status}</span></td>
                  <td>{c.sent_count.toLocaleString()}</td>
                  <td>{Math.round((c.read_count || 0) / (c.sent_count || 1) * 100)}%</td>
                  <td style={{ color: 'var(--tx4)', fontSize: '0.78rem' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td><Link to={`/campaigns/${c.id}/analytics`} className="btn bs bsm">📊</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && campaigns.length === 0 && (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No campaigns found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
