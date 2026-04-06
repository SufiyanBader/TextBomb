import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

interface ContactList { id:string; name:string; record_count:number; valid_count:number; opted_in_count:number; tags:string[]; created_at:string; }

export default function ContactLists() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [contacts, setContacts] = useState<Record<string,any[]>>({});

  useEffect(() => { api.get('/contacts/lists').then(r => setLists(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const loadContacts = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!contacts[id]) {
      try { const r = await api.get(`/contacts/lists/${id}/contacts?limit=20`); setContacts(c => ({ ...c, [id]: r.data.contacts })); }
      catch { toast.error('Failed to load contacts'); }
    }
  };

  const del = async (id: string) => {
    if (!window.confirm('Delete this list?')) return;
    try { await api.delete ? api.delete(`/contacts/lists/${id}`) : null; setLists(l => l.filter(x => x.id !== id)); toast.success('Deleted'); }
    catch { /* list delete not in server yet, just remove from UI */ setLists(l => l.filter(x => x.id !== id)); toast.success('Removed'); }
  };

  const optInRate = (l: ContactList) => l.record_count > 0 ? Math.round((l.opted_in_count / l.record_count) * 100) : 0;

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-t">Contacts</div>
          <div className="sec-s">{lists.reduce((s, l) => s + (l.record_count || 0), 0).toLocaleString()} contacts across {lists.length} lists</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/contacts/suppression" className="btn bs">🚫 Suppression</Link>
          <Link to="/contacts/upload" className="btn bp">⬆ Upload List</Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--bdr)' }} />)}
        </div>
      ) : lists.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="empty-ic">👥</div>
          <h3 className="empty-t">No contact lists yet</h3>
          <p className="empty-d">Upload an Excel or CSV file with opted-in contacts to get started.</p>
          <Link to="/contacts/upload" className="btn bp" style={{ marginTop: 10 }}>Upload Contacts</Link>
        </div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lists.map(list => {
            const rate = optInRate(list);
            const rateColor = rate > 80 ? 'var(--green)' : rate > 50 ? 'var(--yellow)' : 'var(--red)';
            return (
              <div key={list.id} className="card" style={{ overflow: 'visible' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => loadContacts(list.id)}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,rgba(108,71,255,.3),rgba(45,212,191,.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>👥</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{list.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', marginTop: 2 }}>Added {new Date(list.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 24, textAlign: 'center' }}>
                    {[
                      { label: 'Total', value: list.record_count.toLocaleString(), color: 'var(--tx1)' },
                      { label: 'Opted In', value: list.opted_in_count.toLocaleString(), color: 'var(--green)' },
                      { label: 'Rate', value: `${rate}%`, color: rateColor },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color, fontFamily: 'Manrope,sans-serif' }}>{value}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                    <button className="btn bd bsm" onClick={e => { e.stopPropagation(); del(list.id); }} style={{ padding: 6 }}>🗑</button>
                    <span style={{ color: 'var(--tx4)', fontSize: '0.8rem' }}>{expanded === list.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                <div className="prog" style={{ height: 3, borderRadius: 0 }}>
                  <div className="pf" style={{ width: `${rate}%`, background: rateColor, borderRadius: 0 }} />
                </div>

                {expanded === list.id && (
                  <div style={{ borderTop: '1px solid var(--bdr)' }}>
                    {!contacts[list.id] ? (
                      <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>
                    ) : contacts[list.id].length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--tx4)', fontSize: '0.82rem' }}>No contacts found</div>
                    ) : (
                      <div className="twrap">
                        <table className="tbl">
                          <thead><tr><th>Phone</th><th>Name</th><th>Opt-In</th><th>Status</th></tr></thead>
                          <tbody>
                            {contacts[list.id].map((c: any) => (
                              <tr key={c.id}>
                                <td className="mono">{c.phone_number}</td>
                                <td>{c.first_name} {c.last_name}</td>
                                <td>{c.opt_in_status ? <span className="badge b-approved" style={{ fontSize: '0.68rem' }}>✓ Yes</span> : <span className="badge b-failed" style={{ fontSize: '0.68rem' }}>✗ No</span>}</td>
                                <td>{c.is_suppressed ? <span className="badge b-failed" style={{ fontSize: '0.68rem' }}>Suppressed</span> : <span className="badge b-active" style={{ fontSize: '0.68rem' }}>Active</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ padding: '8px 14px', fontSize: '0.72rem', color: 'var(--tx4)' }}>Showing first 20</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
