import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { user, isRole } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [schedMode, setSchedMode] = useState<'now'|'later'>('now');
  const [form, setForm] = useState({
    name: '', template_id: '', list_ids: [] as string[],
    whatsapp_account_id: '', scheduled_at: '',
    use_round_robin: false, template_variables: { body: [] as string[] },
  });
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  useEffect(() => {
    // Get dept-scoped numbers for non-super-admins
    const numReq = user?.department_id && !isRole('super_admin')
      ? api.get(`/number-pool/department/${user.department_id}`)
      : api.get('/whatsapp-accounts');

    Promise.all([
      api.get('/templates?status=approved'),
      api.get('/contacts/lists'),
      numReq,
    ]).then(([t, l, a]) => {
      setTemplates(t.data || []);
      setLists(l.data || []);
      setAccounts(a.data || []);
    }).catch(() => toast.error('Failed to load data'));
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleList = (id: string) => set('list_ids', form.list_ids.includes(id) ? form.list_ids.filter(l => l !== id) : [...form.list_ids, id]);

  const spamWords = ['FREE','WINNER','URGENT','CLICK NOW','BUY NOW','GUARANTEED','CASH','PRIZE'];
  const spamHits = form.name ? spamWords.filter(w => form.name.toUpperCase().includes(w)) : [];

  const submit = async (e: React.FormEvent, launch = false) => {
    e.preventDefault();
    if (!form.template_id) { toast.error('Select a template'); return; }
    if (form.list_ids.length === 0) { toast.error('Select at least one contact list'); return; }
    if (!form.use_round_robin && !form.whatsapp_account_id) { toast.error('Select a WhatsApp number or enable round-robin'); return; }
    if (schedMode === 'later' && !form.scheduled_at) { toast.error('Pick a date and time'); return; }
    if (accounts.filter(a => a.status === 'active').length === 0 && form.use_round_robin) {
      toast.error('No active WhatsApp numbers available'); return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/campaigns', { ...form, scheduled_at: schedMode === 'later' ? new Date(form.scheduled_at).toISOString() : null });
      if (launch) {
        await api.post(`/campaigns/${data.id}/launch`);
        toast.success(`"${form.name}" launched! 🚀`);
      } else {
        toast.success('Campaign saved as draft');
      }
      navigate('/campaigns');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  const bodyVarsCount = selectedTemplate?.components_json?.find((c: any) => c.type === 'BODY')?.text?.match(/\{\{(\d+)\}\}/g)?.length || 0;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="sec-h">
        <div>
          <div className="sec-t">New Campaign</div>
          <div className="sec-s">Configure and send a WhatsApp message campaign</div>
        </div>
      </div>

      <form onSubmit={e => submit(e, false)}>
        {/* Campaign name */}
        <div className="card mb14">
          <div className="card-b">
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Campaign Name *</label>
              <input className="fi" placeholder="e.g. July Product Launch" value={form.name} onChange={e => set('name', e.target.value)} required autoFocus />
              {spamHits.length > 0 && (
                <div className="ibox iy" style={{ marginTop: 8, marginBottom: 0, fontSize: '0.78rem' }}>
                  ⚠️ Name contains common spam words: <strong>{spamHits.join(', ')}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Template */}
        <div className="card mb14">
          <div className="card-h"><div className="card-t">Select Template *</div></div>
          <div className="card-b">
            {templates.length === 0 ? (
              <div className="ibox iy">No approved templates. <a href="/templates/new" style={{ color: 'var(--yellow)' }}>Create one →</a></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {templates.map(t => {
                  const sel = form.template_id === t.id;
                  return (
                    <div key={t.id} onClick={() => { set('template_id', t.id); setSelectedTemplate(t); }}
                      style={{ padding: '11px 14px', borderRadius: 9, border: `1px solid ${sel ? 'rgba(108,71,255,.5)' : 'var(--bdr)'}`, background: sel ? 'rgba(108,71,255,.07)' : 'var(--bg3)', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sel ? 'rgba(108,71,255,.8)' : 'var(--bdr2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(108,71,255,.8)' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', marginTop: 2 }}>{t.category} · {t.language}</div>
                      </div>
                      <span className="badge b-approved" style={{ fontSize: '0.68rem' }}>✓ Approved</span>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTemplate && bodyVarsCount > 0 && (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--bdr)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Template Variables</div>
                {Array.from({ length: bodyVarsCount }).map((_, i) => (
                  <div key={i} className="fg" style={{ marginBottom: i < bodyVarsCount - 1 ? 8 : 0 }}>
                    <label className="fl">Variable {'{{'}{i + 1}{'}}'}</label>
                    <input className="fi" placeholder={`Value for variable ${i + 1}`}
                      value={form.template_variables.body[i] || ''}
                      onChange={e => { const b = [...form.template_variables.body]; b[i] = e.target.value; set('template_variables', { ...form.template_variables, body: b }); }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contact lists */}
        <div className="card mb14">
          <div className="card-h"><div className="card-t">Contact Lists *</div></div>
          <div className="card-b">
            {lists.length === 0 ? (
              <div className="ibox iy">No contact lists. <a href="/contacts/upload" style={{ color: 'var(--yellow)' }}>Upload contacts →</a></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                {lists.map(l => {
                  const sel = form.list_ids.includes(l.id);
                  return (
                    <div key={l.id} onClick={() => toggleList(l.id)} style={{ padding: '10px 13px', borderRadius: 9, border: `1px solid ${sel ? 'rgba(45,212,191,.4)' : 'var(--bdr)'}`, background: sel ? 'rgba(45,212,191,.06)' : 'var(--bg3)', cursor: 'pointer', transition: 'all .15s' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{l.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', marginTop: 3 }}>{(l.opted_in_count || 0).toLocaleString()} opted-in / {(l.record_count || 0).toLocaleString()} total</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sending account */}
        <div className="card mb14">
          <div className="card-h"><div className="card-t">Sending Number *</div></div>
          <div className="card-b">
            {accounts.length === 0 && (
              <div className="ibox ir" style={{ marginBottom: 12 }}>
                ⚠️ No WhatsApp numbers available for your team. {isRole('super_admin') ? <a href="/admin/number-pool" style={{ color: 'var(--red)' }}>Add numbers to the pool →</a> : 'Contact your admin to assign a number.'}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
              <div className={`toggle ${form.use_round_robin ? 'on' : ''}`} onClick={() => set('use_round_robin', !form.use_round_robin)} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Round-robin across all assigned numbers</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--tx4)' }}>Distributes send load evenly across available numbers</div>
              </div>
            </label>
            {!form.use_round_robin && (
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Select Number</label>
                <select className="fi" value={form.whatsapp_account_id} onChange={e => set('whatsapp_account_id', e.target.value)}>
                  <option value="">— Choose number —</option>
                  {accounts.filter(a => a.status === 'active').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.display_name} · {a.phone_number || a.phone_number_id} — {((a.daily_limit || 1000) - (a.daily_sent_count || 0)).toLocaleString()} left today
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="card mb20">
          <div className="card-h"><div className="card-t">Schedule</div></div>
          <div className="card-b">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: schedMode === 'later' ? 14 : 0 }}>
              {[['now','⚡ Send Now','Starts immediately'], ['later','📅 Schedule','Pick date & time']].map(([v, title, sub]) => (
                <div key={v} onClick={() => setSchedMode(v as any)}
                  style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${schedMode === v ? '#fff' : 'var(--bdr)'}`, background: schedMode === v ? 'rgba(255,255,255,.07)' : 'transparent', transition: 'all .15s' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--tx4)', marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>
            {schedMode === 'later' && (
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Date & Time</label>
                <input className="fi" type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn bs" onClick={() => navigate('/campaigns')}>Cancel</button>
          <button type="submit" className="btn bs" disabled={loading}>Save Draft</button>
          <button type="button" className="btn bp" disabled={loading} onClick={e => submit(e as any, true)}>
            {loading ? '⟳' : '▶ Save & Launch'}
          </button>
        </div>
      </form>
    </div>
  );
}
