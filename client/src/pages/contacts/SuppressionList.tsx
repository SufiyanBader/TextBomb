import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function SuppressionList() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('Manual suppression');
  const [adding, setAdding] = useState(false);

  useEffect(() => { api.get('/contacts/suppression-list').then(r => setContacts(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) { toast.error('Phone number required'); return; }
    setAdding(true);
    try {
      await api.post('/contacts/suppress', { phone_number: phone, reason });
      setContacts(c => [{ phone_number: phone, suppression_reason: reason, opted_out_at: new Date().toISOString() }, ...c]);
      setPhone('');
      toast.success('Number suppressed');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setAdding(false); }
  };

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-t">Suppression List</div>
          <div className="sec-s">Numbers excluded from all future campaigns</div>
        </div>
      </div>

      <div className="g2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="card-h">
            <div className="card-t">Suppressed Numbers ({contacts.length})</div>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}><div className="spinner" /></div>
          ) : contacts.length === 0 ? (
            <div className="empty">
              <div className="empty-ic">🚫</div>
              <h3 className="empty-t">No suppressed contacts</h3>
              <p className="empty-d">Numbers added here or from STOP replies will never receive messages.</p>
            </div>
          ) : (
            <div className="twrap">
              <table className="tbl">
                <thead><tr><th>Phone Number</th><th>Name</th><th>Reason</th><th>Date</th></tr></thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={c.id || i}>
                      <td className="mono">{c.phone_number}</td>
                      <td style={{ color: 'var(--tx4)' }}>{c.first_name || '—'}</td>
                      <td><span className="badge b-failed" style={{ fontSize: '0.68rem' }}>{c.suppression_reason || 'Opted out'}</span></td>
                      <td style={{ color: 'var(--tx4)', fontSize: '0.75rem' }}>{c.opted_out_at ? new Date(c.opted_out_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h"><div className="card-t">Add to Suppression List</div></div>
            <div className="card-b">
              <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Phone Number (E.164)</label>
                  <input className="fi" placeholder="+14155238886" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Reason</label>
                  <select className="fi" value={reason} onChange={e => setReason(e.target.value)}>
                    <option>Manual suppression</option>
                    <option>User requested removal</option>
                    <option>Hard bounce</option>
                    <option>Spam complaint</option>
                    <option>Invalid number</option>
                  </select>
                </div>
                <button type="submit" className="btn bd" style={{ justifyContent: 'center' }} disabled={adding}>
                  {adding ? '⟳' : '+ Suppress Number'}
                </button>
              </form>
            </div>
          </div>

          <div className="card" style={{ background: 'rgba(45,212,191,.04)', border: '1px solid var(--tbdr)' }}>
            <div className="card-b">
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>Auto-Suppression</div>
              {['User replies STOP, UNSUBSCRIBE, or QUIT', 'Message hard-bounces (invalid number)', 'Contact explicitly opts out via campaign'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.78rem', color: 'var(--tx3)' }}>
                  <span style={{ color: 'var(--teal)', flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
