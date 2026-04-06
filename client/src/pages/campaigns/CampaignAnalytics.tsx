import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';

const TT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 9, padding: '8px 12px', fontSize: '0.78rem' }}>
      <div style={{ color: 'var(--tx4)', marginBottom: 4 }}>{new Date(label).toLocaleString()}</div>
      {payload.map((p: any) => <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

export default function CampaignAnalytics() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [failures, setFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // If no id, show campaign selector
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState(id || '');

  useEffect(() => {
    if (!id) {
      api.get('/campaigns?limit=50').then(r => {
        const c = r.data.campaigns || [];
        setCampaigns(c);
        if (c.length > 0) setSelectedId(c[0].id);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const cid = id || selectedId;
    if (!cid) return;
    setLoading(true);
    Promise.all([
      api.get(`/campaigns/${cid}`),
      api.get(`/campaigns/${cid}/stats`),
      api.get(`/analytics/campaigns/${cid}/funnel`),
      api.get(`/analytics/campaigns/${cid}/timeseries`),
      api.get(`/analytics/campaigns/${cid}/failures`),
    ]).then(([c, s, f, ts, fail]) => {
      setCampaign(c.data);
      setStats(s.data);
      setFunnel(f.data.funnel || []);
      setTimeseries(ts.data || []);
      setFailures(fail.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, selectedId]);

  if (!id && campaigns.length > 0 && !selectedId) return <div className="spinner" />;

  return (
    <div>
      <div className="sec-h">
        <div>
          {id && <div style={{ marginBottom: 4 }}><Link to="/campaigns" style={{ color: 'var(--tx4)', fontSize: '0.82rem' }}>← Campaigns</Link></div>}
          <div className="sec-t">{campaign?.name || 'Analytics'}</div>
          <div className="sec-s" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Campaign report
            {campaign && <span className={`badge b-${campaign.status}`}>{campaign.status}</span>}
          </div>
        </div>
        {!id && campaigns.length > 0 && (
          <select className="fi" style={{ width: 280 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 100, borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--bdr)' }} />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="sg mb20">
            {[
              { l: 'Sent', v: stats?.sent, c: 'bl' },
              { l: `Delivered (${stats?.delivery_rate}%)`, v: stats?.delivered, c: 'gr' },
              { l: `Read (${stats?.read_rate}%)`, v: stats?.read, c: 'cy' },
              { l: `Replied (${stats?.reply_rate}%)`, v: stats?.replied, c: 'pu' },
              { l: 'Failed', v: stats?.failed, c: 're' },
              { l: `Opt-Outs (${stats?.opt_out_rate}%)`, v: stats?.opted_out, c: 're' },
            ].map(({ l, v, c }) => (
              <div key={l} className={`sc ${c}`}>
                <div className="sc-l">{l}</div>
                <div className="sc-v">{(v || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="g2 mb20">
            {/* Funnel */}
            <div className="card">
              <div className="card-h"><div className="card-t">Delivery Funnel</div></div>
              <div className="card-b">
                {funnel.length > 0 ? (
                  <div className="funnel">
                    {funnel.map(({ stage, count }, i) => {
                      const maxC = funnel[0]?.count || 1;
                      const pct = Math.max(2, Math.round((count / maxC) * 100));
                      const colors = ['rgba(108,71,255,.7)', 'rgba(45,212,191,.7)', 'rgba(74,222,128,.7)', 'rgba(250,204,21,.7)'];
                      return (
                        <div key={stage} className="funnel-row">
                          <div className="funnel-label">{stage}</div>
                          <div className="funnel-bar-wrap">
                            <div className="funnel-bar" style={{ width: `${pct}%`, background: colors[i] || colors[0] }}>
                              {pct > 12 && <span className="funnel-bar-pct">{pct}%</span>}
                            </div>
                          </div>
                          <div className="funnel-val">
                            <span className="funnel-num">{(count || 0).toLocaleString()}</span>
                            <span className="funnel-pct">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="muted">No data yet</div>}
              </div>
            </div>

            {/* Timeseries */}
            <div className="card">
              <div className="card-h"><div className="card-t">Activity Over Time</div></div>
              <div className="card-b">
                {timeseries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={timeseries}>
                      <defs>
                        <linearGradient id="gAS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgba(108,71,255,.8)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="rgba(108,71,255,.8)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--tx4)', fontSize: 10 }} tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--tx4)', fontSize: 10 }} />
                      <Tooltip content={<TT />} />
                      <Area type="monotone" dataKey="sent" name="Sent" stroke="rgba(108,71,255,.8)" strokeWidth={2} fill="url(#gAS)" />
                      <Area type="monotone" dataKey="read" name="Read" stroke="var(--teal)" strokeWidth={2} fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>No time-series data yet</div>}
              </div>
            </div>
          </div>

          {/* Failures */}
          {failures.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t">Failed Messages ({failures.length})</div>
              </div>
              <div className="twrap">
                <table className="tbl">
                  <thead><tr><th>Contact</th><th>Phone</th><th>Reason</th><th>Time</th></tr></thead>
                  <tbody>
                    {failures.slice(0, 50).map((f: any) => (
                      <tr key={f.id}>
                        <td>{f.Contact?.first_name} {f.Contact?.last_name}</td>
                        <td className="mono">{f.Contact?.phone_number}</td>
                        <td style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{f.fail_reason || 'Unknown'}</td>
                        <td style={{ color: 'var(--tx4)', fontSize: '0.75rem' }}>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
