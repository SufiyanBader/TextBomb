import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface Member { id:string; name:string; email:string; role:string; status:string; department_id?:string; last_login_at?:string; }
interface Dept { id:string; name:string; }

const ROLE_BADGE: Record<string,string> = { super_admin:'b-sending', dept_admin:'b-pooled', member:'b-gray' };

export default function Members() {
  const { isRole, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'member', department_id:'' });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/departments')])
      .then(([u, d]) => { setMembers(u.data || []); setDepts(d.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data } = await api.post('/users/add', form);
      setMembers(m => [data, ...m]);
      setShowForm(false);
      setForm({ name:'', email:'', password:'', role:'member', department_id:'' });
      toast.success('Member added');
    } catch (err: any) { toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed'); }
    finally { setAdding(false); }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api.put(`/users/${id}/role`, { role });
      setMembers(m => m.map(x => x.id === id ? { ...x, role } : x));
      toast.success('Role updated');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deactivate = async (id: string) => {
    if (!window.confirm('Deactivate this member?')) return;
    try {
      await api.delete(`/users/${id}`);
      setMembers(m => m.map(x => x.id === id ? { ...x, status: 'inactive' } : x));
      toast.success('Deactivated');
    } catch { toast.error('Failed'); }
  };

  const filtered = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  );

  const getDeptName = (id?: string) => depts.find(d => d.id === id)?.name || '—';

  return (
    <div>
      <div className="sec-h">
        <div><div className="sec-t">Members</div><div className="sec-s">{members.length} team member{members.length !== 1 ? 's' : ''}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="fi" style={{ width: 200 }} placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
          {isRole('super_admin', 'dept_admin') && <button className="btn bp" onClick={() => setShowForm(true)}>+ Add Member</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 52, borderRadius: 8, background: 'var(--bg3)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-ic">👤</div>
            <h3 className="empty-t">{search ? 'No members found' : 'No team members yet'}</h3>
            <p className="empty-d">{search ? 'Try a different search.' : 'Add team members to collaborate.'}</p>
          </div>
        ) : (
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>Member</th><th>Role</th><th>Department</th><th>Status</th><th>Last Login</th>{isRole('super_admin') && <th>Actions</th>}</tr></thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} style={{ opacity: m.status === 'inactive' ? .4 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(108,71,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--tx4)' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isRole('super_admin') && m.id !== user?.id && m.role !== 'super_admin' ? (
                        <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                          style={{ background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 7, padding: '4px 8px', color: 'var(--tx2)', fontSize: '0.78rem', cursor: 'pointer' }}>
                          <option value="member">Member</option>
                          <option value="dept_admin">Dept Admin</option>
                        </select>
                      ) : (
                        <span className={`badge ${ROLE_BADGE[m.role] || 'b-gray'}`} style={{ fontSize: '0.7rem' }}>{m.role.replace('_', ' ')}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--tx4)', fontSize: '0.82rem' }}>{getDeptName(m.department_id)}</td>
                    <td><span className={`badge ${m.status === 'active' ? 'b-active' : 'b-failed'}`} style={{ fontSize: '0.7rem' }}>{m.status}</span></td>
                    <td style={{ color: 'var(--tx4)', fontSize: '0.75rem' }}>{m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : 'Never'}</td>
                    {isRole('super_admin') && (
                      <td>
                        {m.id !== user?.id && m.role !== 'super_admin' && m.status === 'active' && (
                          <button className="btn bd bsm" onClick={() => deactivate(m.id)}>Deactivate</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="mbg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal mmd">
            <div className="mh">
              <div><div className="mt">Add Team Member</div></div>
              <button className="xb" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={add}>
              <div className="mb">
                <div className="fi2">
                  <div className="fg"><label className="fl">Full Name *</label><input className="fi" placeholder="Jane Smith" value={form.name} onChange={e => set('name', e.target.value)} required autoFocus /></div>
                  <div className="fg"><label className="fl">Role *</label>
                    <select className="fi" value={form.role} onChange={e => set('role', e.target.value)}>
                      <option value="member">Member</option>
                      <option value="dept_admin">Dept Admin</option>
                    </select>
                  </div>
                </div>
                <div className="fg"><label className="fl">Email *</label><input className="fi" type="email" placeholder="jane@company.com" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
                <div className="fg"><label className="fl">Department</label>
                  <select className="fi" value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                    <option value="">— No department —</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Temporary Password *</label>
                  <input className="fi" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => set('password', e.target.value)} required />
                  <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', marginTop: 3 }}>They should change this after first login.</div>
                </div>
              </div>
              <div className="mf">
                <button type="button" className="btn bs" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn bp" disabled={adding}>{adding ? '⟳' : 'Add Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
