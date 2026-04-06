import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface PoolNumber {
  id: string; display_name: string; phone_number?: string; phone_number_id: string;
  bsp: string; status: string; quality_rating: string;
  daily_sent_count: number; daily_limit: number;
  monthly_sent_count: number; monthly_limit: number;
  notes?: string; assigned_departments: { id: string; name: string }[];
  created_at: string;
}
interface Dept { id: string; name: string; }

const BSP_LABELS: Record<string, string> = { meta_direct: 'Meta Direct', twilio: 'Twilio', '360dialog': '360dialog', gupshup: 'Gupshup' };
const QUALITY_COLOR: Record<string, string> = { GREEN: 'var(--green)', YELLOW: 'var(--yellow)', RED: 'var(--red)', UNKNOWN: 'var(--tx4)' };

export default function NumberPool() {
  const { isRole } = useAuth();
  const [numbers, setNumbers] = useState<PoolNumber[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Add number modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ phone_number_id: '', api_key: '', display_name: '', bsp: 'meta_direct', waba_id: '', notes: '', monthly_limit: '10000', department_ids: [] as string[] });
  const [addLoading, setAddLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Assignment modal
  const [assignModal, setAssignModal] = useState<PoolNumber | null>(null);
  const [assignDept, setAssignDept] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignHistory, setAssignHistory] = useState<any[]>([]);

  // Stats modal
  const [statsModal, setStatsModal] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Rotate key modal
  const [rotateModal, setRotateModal] = useState<PoolNumber | null>(null);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    load();
  }, [filter]);

  const load = async () => {
    setLoading(true);
    try {
      const [nums, deps] = await Promise.all([
        api.get(`/number-pool?filter=${filter}`),
        api.get('/departments'),
      ]);
      setNumbers(nums.data || []);
      setDepts(deps.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const addNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.phone_number_id || !addForm.api_key || !addForm.display_name) {
      toast.error('Phone Number ID, Access Token, and Display Name are required'); return;
    }
    setAddLoading(true);
    try {
      const { data } = await api.post('/number-pool/add', { ...addForm, monthly_limit: parseInt(addForm.monthly_limit) });
      setNumbers(n => [data, ...n]);
      setShowAdd(false);
      setAddForm({ phone_number_id: '', api_key: '', display_name: '', bsp: 'meta_direct', waba_id: '', notes: '', monthly_limit: '10000', department_ids: [] });
      toast.success('Number added to pool!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add number');
    } finally { setAddLoading(false); }
  };

  const openAssign = async (num: PoolNumber) => {
    setAssignModal(num);
    setAssignDept('');
    try {
      const { data } = await api.get(`/number-pool/${num.id}/assignments`);
      setAssignHistory(data || []);
    } catch { setAssignHistory([]); }
  };

  const doAssign = async () => {
    if (!assignDept || !assignModal) return;
    setAssignLoading(true);
    try {
      const { data } = await api.post('/number-pool/assign', {
        whatsapp_account_id: assignModal.id, department_id: assignDept,
      });
      setNumbers(ns => ns.map(n => n.id === assignModal.id ? { ...n, assigned_departments: data.account.assigned_departments || n.assigned_departments } : n));
      setAssignModal(prev => prev ? { ...prev, assigned_departments: data.account.assigned_departments || prev.assigned_departments } : null);
      setAssignDept('');
      toast.success('Assigned!');
      const { data: hist } = await api.get(`/number-pool/${assignModal.id}/assignments`);
      setAssignHistory(hist || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign');
    } finally { setAssignLoading(false); }
  };

  const removeAssign = async (num: PoolNumber, deptId: string) => {
    try {
      const { data } = await api.delete('/number-pool/assign', { data: { whatsapp_account_id: num.id, department_id: deptId } } as any);
      await load();
      if (assignModal?.id === num.id) {
        const { data: hist } = await api.get(`/number-pool/${num.id}/assignments`);
        setAssignHistory(hist || []);
      }
      toast.success('Assignment removed');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const openStats = async (num: PoolNumber) => {
    setStatsLoading(true);
    setStatsModal({ loading: true, name: num.display_name });
    try {
      const { data } = await api.get(`/number-pool/${num.id}/stats`);
      setStatsModal(data);
    } catch { toast.error('Failed to load stats'); setStatsModal(null); }
    finally { setStatsLoading(false); }
  };

  const removeNumber = async (num: PoolNumber) => {
    if (!window.confirm(`Remove "${num.display_name}" from the pool? This cannot be undone.`)) return;
    try {
      await api.delete(`/number-pool/${num.id}`);
      setNumbers(ns => ns.filter(n => n.id !== num.id));
      toast.success('Number removed');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to remove'); }
  };

  const doRotateKey = async () => {
    if (!rotateModal || !newKey.trim()) { toast.error('New API key required'); return; }
    try {
      await api.post(`/number-pool/${rotateModal.id}/rotate-key`, { new_api_key: newKey });
      toast.success('API key rotated!');
      setRotateModal(null); setNewKey('');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const filtered = numbers.filter(n =>
    n.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (n.phone_number || '').includes(search) ||
    n.phone_number_id.includes(search)
  );

  const quotaColor = (used: number, total: number) => {
    const p = (used / total) * 100;
    return p > 90 ? 'var(--red)' : p > 70 ? 'var(--yellow)' : 'var(--green)';
  };

  if (!isRole('super_admin')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="empty">
          <div className="empty-ic">🔒</div>
          <h3 className="empty-t">Super Admin Only</h3>
          <p className="empty-d">Number Pool management is restricted to Super Admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="sec-h">
        <div>
          <div className="sec-t">📱 Number Pool</div>
          <div className="sec-s">Manage WhatsApp Business numbers and assign them to departments</div>
        </div>
        <button className="btn bp" onClick={() => setShowAdd(true)}>+ Add Number</button>
      </div>

      {/* Stats */}
      <div className="sg" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="sc bl">
          <div className="sc-ic">📱</div>
          <div className="sc-l">Total Numbers</div>
          <div className="sc-v">{numbers.length}</div>
          <div className="sc-sub">{numbers.filter(n => n.status === 'active').length} active</div>
        </div>
        <div className="sc gr">
          <div className="sc-ic">✅</div>
          <div className="sc-l">Assigned</div>
          <div className="sc-v">{numbers.filter(n => n.assigned_departments.length > 0).length}</div>
          <div className="sc-sub">to departments</div>
        </div>
        <div className="sc cy">
          <div className="sc-ic">📤</div>
          <div className="sc-l">Sent Today</div>
          <div className="sc-v">{numbers.reduce((s, n) => s + (n.daily_sent_count || 0), 0).toLocaleString()}</div>
          <div className="sc-sub">across all numbers</div>
        </div>
        <div className="sc pu">
          <div className="sc-ic">🏢</div>
          <div className="sc-l">Departments</div>
          <div className="sc-v">{depts.length}</div>
          <div className="sc-sub">{numbers.filter(n => n.assigned_departments.length === 0).length} unassigned numbers</div>
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[['all', 'All'], ['assigned', 'Assigned'], ['unassigned', 'Unassigned']].map(([v, l]) => (
            <button key={v} className={`tab ${filter === v ? 'act' : ''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
        <input className="fi" style={{ maxWidth: 240 }} placeholder="🔍 Search numbers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Number Cards Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 220, borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--bdr)', animation: 'pulse 1.5s ease infinite' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-ic">📱</div>
            <h3 className="empty-t">No numbers {filter !== 'all' ? `matching "${filter}"` : 'in pool'}</h3>
            <p className="empty-d">{filter === 'all' ? 'Add your first WhatsApp Business number to get started.' : 'Try a different filter.'}</p>
            {filter === 'all' && <button className="btn bp" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>+ Add Number</button>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
          {filtered.map(num => {
            const dailyPct = num.daily_limit > 0 ? Math.min(100, Math.round((num.daily_sent_count / num.daily_limit) * 100)) : 0;
            const monthlyPct = num.monthly_limit > 0 ? Math.min(100, Math.round((num.monthly_sent_count / num.monthly_limit) * 100)) : 0;
            return (
              <div key={num.id} className="pool-card">
                {/* Header */}
                <div className="pool-card-header">
                  <div className="pool-icon">📱</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{num.display_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--tx4)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
                      {num.phone_number || num.phone_number_id}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      <span className={`badge ${num.status === 'active' ? 'b-active' : 'b-paused'}`}>{num.status}</span>
                      <span className="badge b-gray" style={{ fontSize: '0.68rem' }}>{BSP_LABELS[num.bsp] || num.bsp}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: QUALITY_COLOR[num.quality_rating] }}>
                        ● {num.quality_rating}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="pool-card-body">
                  {/* Daily quota */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--tx4)' }}>Daily</span>
                      <span style={{ fontWeight: 600, color: quotaColor(num.daily_sent_count, num.daily_limit) }}>
                        {num.daily_sent_count.toLocaleString()} / {num.daily_limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="prog">
                      <div className="pf" style={{ width: `${dailyPct}%`, background: quotaColor(num.daily_sent_count, num.daily_limit) }} />
                    </div>
                  </div>

                  {/* Monthly quota */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--tx4)' }}>Monthly</span>
                      <span style={{ fontWeight: 600 }}>{num.monthly_sent_count.toLocaleString()} / {num.monthly_limit.toLocaleString()}</span>
                    </div>
                    <div className="prog">
                      <div className="pf" style={{ width: `${monthlyPct}%`, background: 'linear-gradient(90deg,#6c47ff,#2dd4bf)' }} />
                    </div>
                  </div>

                  {/* Assigned departments */}
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Assigned To
                    </div>
                    {num.assigned_departments.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--tx4)', fontStyle: 'italic' }}>— Not assigned to any department</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {num.assigned_departments.map(dept => (
                          <span key={dept.id} className="dept-chip">
                            🏢 {dept.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {num.notes && (
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--tx4)', fontStyle: 'italic', padding: '6px 8px', background: 'rgba(255,255,255,.03)', borderRadius: 6 }}>
                      {num.notes}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="pool-card-footer">
                  <button className="btn bs bsm" onClick={() => openAssign(num)}>🏢 Manage Assignments</button>
                  <button className="btn bs bsm" onClick={() => openStats(num)}>📊 Stats</button>
                  <button className="btn bs bsm" onClick={() => { setRotateModal(num); setNewKey(''); }}>🔑 Rotate Key</button>
                  <button className="btn bd bsm" onClick={() => removeNumber(num)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD NUMBER MODAL ─────────────────────────────────────────── */}
      {showAdd && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal mlg">
            <div className="mh">
              <div><div className="mt">📱 Add Number to Pool</div><div className="msub">Connect a WhatsApp Business API number to the organization pool</div></div>
              <button className="xb" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={addNumber}>
              <div className="mb">
                <div className="ibox ib" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
                  🔒 The access token is encrypted with AES-256-GCM and never returned to the frontend after saving.
                </div>
                <div className="fi2">
                  <div className="fg">
                    <label className="fl">Display Name *</label>
                    <input className="fi" placeholder="e.g. Marketing Line US" value={addForm.display_name}
                      onChange={e => setAddForm(f => ({ ...f, display_name: e.target.value }))} required autoFocus />
                  </div>
                  <div className="fg">
                    <label className="fl">BSP / Provider *</label>
                    <select className="fi" value={addForm.bsp} onChange={e => setAddForm(f => ({ ...f, bsp: e.target.value }))}>
                      {Object.entries(BSP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="fi2">
                  <div className="fg">
                    <label className="fl">Phone Number ID *</label>
                    <input className="fi" placeholder="From Meta Developer Console" value={addForm.phone_number_id}
                      onChange={e => setAddForm(f => ({ ...f, phone_number_id: e.target.value }))} required />
                  </div>
                  <div className="fg">
                    <label className="fl">WABA ID</label>
                    <input className="fi" placeholder="WhatsApp Business Account ID" value={addForm.waba_id}
                      onChange={e => setAddForm(f => ({ ...f, waba_id: e.target.value }))} />
                  </div>
                </div>
                <div className="fg">
                  <label className="fl">Permanent Access Token *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="fi" type={showKey ? 'text' : 'password'} placeholder="Your Meta API permanent access token"
                      value={addForm.api_key} onChange={e => setAddForm(f => ({ ...f, api_key: e.target.value }))}
                      style={{ paddingRight: 38 }} required />
                    <span onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--tx4)', fontSize: 12 }}>
                      {showKey ? '🙈' : '👁'}
                    </span>
                  </div>
                </div>
                <div className="fi2">
                  <div className="fg">
                    <label className="fl">Monthly Send Limit</label>
                    <input className="fi" type="number" min="100" value={addForm.monthly_limit}
                      onChange={e => setAddForm(f => ({ ...f, monthly_limit: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label className="fl">Notes (internal only)</label>
                    <input className="fi" placeholder="Optional notes for admins" value={addForm.notes}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                {depts.length > 0 && (
                  <div className="fg">
                    <label className="fl">Assign to Departments (optional)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {depts.map(d => {
                        const selected = addForm.department_ids.includes(d.id);
                        return (
                          <button key={d.id} type="button"
                            onClick={() => setAddForm(f => ({
                              ...f,
                              department_ids: selected ? f.department_ids.filter(id => id !== d.id) : [...f.department_ids, d.id],
                            }))}
                            className={`btn bsm ${selected ? 'bg_' : 'bs'}`}>
                            🏢 {d.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="mf">
                <button type="button" className="btn bs" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn bp" disabled={addLoading}>
                  {addLoading ? <span style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}>⟳</span> : '+ Add to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ASSIGN MODAL ─────────────────────────────────────────────── */}
      {assignModal && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setAssignModal(null)}>
          <div className="modal mlg">
            <div className="mh">
              <div>
                <div className="mt">🏢 Manage Assignments</div>
                <div className="msub">{assignModal.display_name} · {assignModal.phone_number || assignModal.phone_number_id}</div>
              </div>
              <button className="xb" onClick={() => setAssignModal(null)}>✕</button>
            </div>
            <div className="mb">
              {/* Current assignments */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Currently Assigned
                </div>
                {assignModal.assigned_departments.length === 0 ? (
                  <div style={{ color: 'var(--tx4)', fontSize: '0.85rem', fontStyle: 'italic' }}>No departments assigned yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assignModal.assigned_departments.map(dept => (
                      <div key={dept.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--tbdr)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1.1rem' }}>🏢</span>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dept.name}</span>
                        </div>
                        <button className="btn bd bsm" onClick={() => removeAssign(assignModal, dept.id)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add assignment */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Add Assignment
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="fi" value={assignDept} onChange={e => setAssignDept(e.target.value)} style={{ flex: 1 }}>
                    <option value="">— Select department —</option>
                    {depts.filter(d => !assignModal.assigned_departments.find(a => a.id === d.id)).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button className="btn bg_" onClick={doAssign} disabled={assignLoading || !assignDept}>
                    {assignLoading ? '⟳' : 'Assign'}
                  </button>
                </div>
              </div>

              {/* History */}
              {assignHistory.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Assignment History
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {assignHistory.map(h => (
                      <div key={h.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--bdr)', fontSize: '0.78rem', color: 'var(--tx4)' }}>
                        <span style={{ color: h.unassigned_at ? 'var(--red)' : 'var(--green)', flexShrink: 0 }}>
                          {h.unassigned_at ? '↖' : '→'}
                        </span>
                        <span style={{ flex: 1 }}>
                          {h.Department?.name || 'Unknown dept'} ·
                          Assigned {new Date(h.assigned_at).toLocaleDateString()}
                          {h.unassigned_at ? ` → Removed ${new Date(h.unassigned_at).toLocaleDateString()}` : ' (current)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mf">
              <button className="btn bs" onClick={() => setAssignModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STATS MODAL ──────────────────────────────────────────────── */}
      {statsModal && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setStatsModal(null)}>
          <div className="modal mmd">
            <div className="mh">
              <div><div className="mt">📊 Number Stats</div><div className="msub">{statsModal.account?.display_name || statsModal.name}</div></div>
              <button className="xb" onClick={() => setStatsModal(null)}>✕</button>
            </div>
            <div className="mb">
              {statsLoading || statsModal.loading ? (
                <div className="spinner" />
              ) : (
                <div className="g2">
                  {[
                    { label: 'Total Campaigns', value: statsModal.total_campaigns, color: 'var(--tx1)' },
                    { label: 'Total Sent', value: (statsModal.total_sent || 0).toLocaleString(), color: 'var(--blue)' },
                    { label: 'Delivered', value: (statsModal.total_delivered || 0).toLocaleString(), color: 'var(--green)' },
                    { label: 'Delivery Rate', value: `${statsModal.delivery_rate || 0}%`, color: statsModal.delivery_rate > 90 ? 'var(--green)' : 'var(--yellow)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--bdr)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color, fontFamily: 'Manrope, sans-serif' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mf"><button className="btn bs" onClick={() => setStatsModal(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* ─── ROTATE KEY MODAL ─────────────────────────────────────────── */}
      {rotateModal && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setRotateModal(null)}>
          <div className="modal mmd">
            <div className="mh">
              <div><div className="mt">🔑 Rotate API Key</div><div className="msub">{rotateModal.display_name}</div></div>
              <button className="xb" onClick={() => setRotateModal(null)}>✕</button>
            </div>
            <div className="mb">
              <div className="ibox iy" style={{ marginBottom: 14 }}>
                ⚠️ Rotating the key will immediately replace the stored credentials. Any in-progress campaigns will use the new key on the next send.
              </div>
              <div className="fg">
                <label className="fl">New Access Token *</label>
                <input className="fi" type="password" placeholder="New permanent access token" value={newKey} onChange={e => setNewKey(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="mf">
              <button className="btn bs" onClick={() => setRotateModal(null)}>Cancel</button>
              <button className="btn bd" onClick={doRotateKey}>🔑 Rotate Key</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
