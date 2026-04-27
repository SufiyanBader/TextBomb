import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

interface Campaign { id:string; name:string; status:string; sent_count:number; read_count?:number; total_recipients:number; created_at:string; scheduled_at?:string; MessageTemplate?:{name:string;category:string}; }

const STATUS_CLASS: Record<string,string> = { completed:'b-completed', sending:'b-sending', paused:'b-paused', failed:'b-failed', scheduled:'b-scheduled', draft:'b-draft' };

export default function CampaignList() {
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [launching, setLaunching] = useState<string|null>(null);

  useEffect(() => {
    const p = filter !== 'all' ? `?status=${filter}` : '';
    api.get(`/campaigns${p}`).then(r => setCamps(r.data.campaigns || [])).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const launch = async (id: string) => {
    setLaunching(id);
    try {
      await api.post(`/campaigns/${id}/launch`);
      toast.success('Campaign launched! 🚀');
      setCamps(cs => cs.map(c => c.id === id ? { ...c, status: 'sending' } : c));
    } catch (err: any) { toast.error(err.response?.data?.error || 'Launch failed'); }
    finally { setLaunching(null); }
  };

  const pause = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      toast.success('Paused');
      setCamps(cs => cs.map(c => c.id === id ? { ...c, status: 'paused' } : c));
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const del = async (id: string) => {
    const c = camps.find(c => c.id === id);
    if (!window.confirm(`Delete "${c?.name}"?`)) return;
    try {
      await api.delete(`/campaigns/${id}`);
      setCamps(cs => cs.filter(c => c.id !== id));
      toast.success('Deleted');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const filtered = camps.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page act">
      <div className="sec-h">
        <div>
          <div className="sec-t">Campaigns</div>
          <div className="sec-s">{camps.length} campaign{camps.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fi" style={{ width: 190 }} placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <Link to="/campaigns/new" className="btn bp">+ New Campaign</Link>
        </div>
      </div>

      {/* Sending live bands */}
      {camps.filter(c => c.status === 'sending').map(c => {
        const pct = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
        return (
          <div key={c.id} className="live-band mb14">
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>📤 {c.name}</div>
              <div style={{ marginTop: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--tx4)', marginBottom: 3 }}>
                  <span>{c.sent_count.toLocaleString()} sent</span>
                  <span>{pct}%</span>
                </div>
                <div className="prog"><div className="pf pg" style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
            <button className="btn bs bsm" onClick={() => pause(c.id)}>⏸ Pause</button>
            <Link to={`/campaigns/${c.id}/analytics`} className="btn bs bsm">📊 Stats</Link>
          </div>
        );
      })}

      {/* Filter tabs */}
      <div className="tabs">
        {['all','draft','scheduled','sending','completed','failed','paused'].map(s => (
          <button key={s} className={`tab ${filter === s ? 'act' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--bg3)', animation: 'pulse 1.5s ease infinite' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-ic">📭</div>
            <h3 className="empty-t">No campaigns found</h3>
            <p className="empty-d">Create a campaign to start sending WhatsApp messages.</p>
            <Link to="/campaigns/new" className="btn bp" style={{ marginTop: 10 }}>+ New Campaign</Link>
          </div>
        ) : (
          <div className="twrap">
            <table className="tbl">
              <thead>
                <tr><th>Campaign</th><th>Template</th><th>Status</th><th>Progress</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const pct = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.scheduled_at && c.status === 'scheduled' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--teal)', marginTop: 2 }}>
                            🕐 {new Date(c.scheduled_at).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--tx4)' }}>
                        {c.MessageTemplate?.name || '—'}
                        {c.MessageTemplate?.category && (
                          <span style={{ marginLeft: 5, fontSize: '0.68rem', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 3 }}>{c.MessageTemplate.category}</span>
                        )}
                      </td>
                      <td><span className={`badge b-${c.status}`}>{c.status}</span></td>
                      <td style={{ minWidth: 130 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div className="prog" style={{ flex: 1 }}>
                            <div className="pf" style={{ width: `${pct}%`, background: c.status === 'completed' ? 'var(--green)' : 'rgba(108,71,255,.8)' }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--tx4)', whiteSpace: 'nowrap' }}>{c.sent_count}/{c.total_recipients}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--tx4)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <Link to={`/campaigns/${c.id}/analytics`} className="btn bs bsm">📊</Link>
                          {['draft', 'scheduled', 'paused'].includes(c.status) && (
                            <button className="btn bg_ bsm" onClick={() => launch(c.id)} disabled={launching === c.id}>
                              {launching === c.id ? '⟳' : '▶'}
                            </button>
                          )}
                          {c.status === 'sending' && <button className="btn bs bsm" onClick={() => pause(c.id)}>⏸</button>}
                          <button className="btn bd bsm" onClick={() => del(c.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
