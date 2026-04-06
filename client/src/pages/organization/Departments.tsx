import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

interface Dept { id:string; name:string; created_at:string; Users?:any[]; }

export default function Departments() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { api.get('/departments').then(r => setDepts(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/departments', { name });
      setDepts(d => [...d, { ...data, Users: [] }]);
      setName(''); setShowForm(false);
      toast.success('Department created');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const del = async (id: string) => {
    if (!window.confirm('Delete this department? Members will be unassigned.')) return;
    try {
      await api.delete(`/departments/${id}`);
      setDepts(d => d.filter(x => x.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="sec-h">
        <div><div className="sec-t">Departments</div><div className="sec-s">Organize your team into departments</div></div>
        <button className="btn bp" onClick={() => setShowForm(true)}>+ New Department</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 72, borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--bdr)' }} />)}
        </div>
      ) : depts.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="empty-ic">🏢</div>
          <h3 className="empty-t">No departments yet</h3>
          <p className="empty-d">Create departments to organize your team and assign WhatsApp numbers.</p>
          <button className="btn bp" style={{ marginTop: 10 }} onClick={() => setShowForm(true)}>+ Create Department</button>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {depts.map(d => (
            <div key={d.id} className="card">
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,rgba(108,71,255,.3),rgba(45,212,191,.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏢</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', marginTop: 2 }}>{d.Users?.length || 0} member{(d.Users?.length || 0) !== 1 ? 's' : ''}</div>
                </div>
                <button className="btn bd bsm btn-icon" onClick={() => del(d.id)} style={{ padding: 6 }}>🗑</button>
              </div>
              {d.Users && d.Users.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bdr)', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {d.Users.slice(0, 5).map((u: any) => (
                    <div key={u.id} className="chip" style={{ fontSize: '0.7rem' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(108,71,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      {u.name?.split(' ')[0]}
                    </div>
                  ))}
                  {(d.Users.length > 5) && <div className="chip" style={{ fontSize: '0.7rem', color: 'var(--tx4)' }}>+{d.Users.length - 5}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal mmd">
            <div className="mh">
              <div className="mt">New Department</div>
              <button className="xb" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={create}>
              <div className="mb">
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Department Name *</label>
                  <input className="fi" placeholder="e.g. Marketing, Sales, Support" value={name} onChange={e => setName(e.target.value)} required autoFocus />
                </div>
              </div>
              <div className="mf">
                <button type="button" className="btn bs" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn bp" disabled={creating}>{creating ? '⟳' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
