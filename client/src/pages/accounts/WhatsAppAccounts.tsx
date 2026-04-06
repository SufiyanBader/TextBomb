import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface Account { id:string; display_name:string; phone_number?:string; phone_number_id:string; bsp:string; status:string; quality_rating:string; daily_sent_count:number; daily_limit:number; monthly_sent_count:number; monthly_limit:number; is_pooled:boolean; assigned_departments?:any[]; }

const BSP: Record<string,string> = { meta_direct:'Meta Direct', twilio:'Twilio', '360dialog':'360dialog', gupshup:'Gupshup' };
const QC: Record<string,string> = { GREEN:'var(--green)', YELLOW:'var(--yellow)', RED:'var(--red)', UNKNOWN:'var(--tx4)' };

export default function WhatsAppAccounts() {
  const { isRole, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ phone_number_id:'', api_key:'', display_name:'', bsp:'meta_direct', waba_id:'' });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    api.get('/whatsapp-accounts').then(r => setAccounts(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/whatsapp-accounts/connect', form);
      setAccounts(a => [data, ...a]);
      setShowForm(false);
      setForm({ phone_number_id:'', api_key:'', display_name:'', bsp:'meta_direct', waba_id:'' });
      toast.success('Account connected!');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const toggleStatus = async (id: string, cur: string) => {
    const ns = cur === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/whatsapp-accounts/${id}/status`, { status: ns });
      setAccounts(a => a.map(acc => acc.id === id ? { ...acc, status: ns } : acc));
      toast.success(`Account ${ns}`);
    } catch { toast.error('Failed'); }
  };

  const disconnect = async (id: string) => {
    if (!window.confirm('Disconnect this account?')) return;
    try {
      await api.delete(`/whatsapp-accounts/${id}`);
      setAccounts(a => a.filter(acc => acc.id !== id));
      toast.success('Disconnected');
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-t">WA Accounts</div>
          <div className="sec-s">Your personal connected WhatsApp accounts</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isRole('super_admin') && (
            <Link to="/admin/number-pool" className="btn bs">📱 Number Pool →</Link>
          )}
          {isRole('super_admin', 'dept_admin') && (
            <button className="btn bp" onClick={() => setShowForm(true)}>+ Connect Account</button>
          )}
        </div>
      </div>

      {isRole('super_admin') && (
        <div className="ibox ib" style={{ marginBottom: 16 }}>
          💡 <strong style={{ color: 'var(--teal)' }}>Tip:</strong> Use the <Link to="/admin/number-pool" style={{ color: 'var(--teal)', fontWeight: 600 }}>Number Pool</Link> to manage org-wide numbers and assign them to departments. This page is for directly-connected accounts.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {[1, 2].map(i => <div key={i} style={{ height: 160, borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--bdr)' }} />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="empty-ic">📱</div>
          <h3 className="empty-t">No accounts connected</h3>
          <p className="empty-d">Connect a WhatsApp Business account to start sending.</p>
          {isRole('super_admin', 'dept_admin') && <button className="btn bp" style={{ marginTop: 10 }} onClick={() => setShowForm(true)}>+ Connect Account</button>}
        </div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {accounts.map(acc => {
            const qpct = Math.round((acc.daily_sent_count / (acc.daily_limit || 1)) * 100);
            return (
              <div key={acc.id} className="card">
                <div style={{ padding: '14px 16px', display: 'flex', gap: 12, borderBottom: '1px solid var(--bdr)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#25d366,#128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>📱</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{acc.display_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', fontFamily: 'DM Mono,monospace', marginTop: 2 }}>{acc.phone_number || acc.phone_number_id}</div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                      <span className={`badge ${acc.status === 'active' ? 'b-active' : 'b-paused'}`}>{acc.status}</span>
                      <span className="badge b-gray" style={{ fontSize: '0.68rem' }}>{BSP[acc.bsp] || acc.bsp}</span>
                      {acc.is_pooled && <span className="badge b-pooled" style={{ fontSize: '0.68rem' }}>Pool</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div className={`toggle ${acc.status === 'active' ? 'on' : ''}`} onClick={() => isRole('super_admin','dept_admin') && toggleStatus(acc.id, acc.status)} />
                    <span style={{ fontSize: '0.65rem', color: QC[acc.quality_rating], fontWeight: 700 }}>{acc.quality_rating}</span>
                  </div>
                </div>

                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4, color: 'var(--tx4)' }}>
                    <span>Daily quota</span>
                    <span style={{ fontWeight: 600, color: qpct > 80 ? 'var(--red)' : 'var(--tx2)' }}>{acc.daily_sent_count.toLocaleString()} / {acc.daily_limit.toLocaleString()}</span>
                  </div>
                  <div className="prog">
                    <div className="pf" style={{ width: `${Math.min(qpct, 100)}%`, background: qpct > 80 ? 'var(--red)' : qpct > 60 ? 'var(--yellow)' : 'var(--green)' }} />
                  </div>
                </div>

                {isRole('super_admin', 'dept_admin') && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bdr)', display: 'flex', gap: 6 }}>
                    <button className={`btn bsm ${acc.status === 'active' ? 'bs' : 'bg_'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => toggleStatus(acc.id, acc.status)}>
                      {acc.status === 'active' ? '⏸ Pause' : '▶ Activate'}
                    </button>
                    <button className="btn bd bsm" onClick={() => disconnect(acc.id)}>Disconnect</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Modal */}
      {showForm && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal mmd">
            <div className="mh">
              <div><div className="mt">📱 Connect Account</div><div className="msub">Add a WhatsApp Business API number</div></div>
              <button className="xb" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={connect}>
              <div className="mb">
                <div className="fg"><label className="fl">Display Name *</label><input className="fi" placeholder="My Business" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required autoFocus /></div>
                <div className="fg"><label className="fl">BSP *</label>
                  <select className="fi" value={form.bsp} onChange={e => setForm(f => ({ ...f, bsp: e.target.value }))}>
                    {Object.entries(BSP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Phone Number ID *</label><input className="fi" placeholder="From Meta Console" value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} required /></div>
                <div className="fg"><label className="fl">WABA ID</label><input className="fi" placeholder="Optional" value={form.waba_id} onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))} /></div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Access Token *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="fi" type={showKey ? 'text' : 'password'} placeholder="Permanent access token" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} style={{ paddingRight: 38 }} required />
                    <span onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--tx4)', fontSize: 12 }}>{showKey ? '🙈' : '👁'}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', marginTop: 4 }}>Stored encrypted with AES-256-GCM. Never shown again.</div>
                </div>
              </div>
              <div className="mf">
                <button type="button" className="btn bs" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn bp" disabled={submitting}>{submitting ? '⟳' : 'Connect'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
