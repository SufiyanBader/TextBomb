import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function OrgSettings() {
  const { org, isRole } = useAuth();
  const [form, setForm] = useState({ name: '', domain: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org').then(r => setForm({ name: r.data.name || '', domain: r.data.domain || '' })).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/org/update', form);
      toast.success('Settings saved');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const PLAN_FEATURES: Record<string, string[]> = {
    free: ['Up to 1,000 messages/month', '1 WhatsApp account', '3 templates', 'Basic analytics'],
    starter: ['Up to 10,000 messages/month', '3 WhatsApp accounts', 'Unlimited templates', 'Full analytics'],
    pro: ['Up to 100,000 messages/month', '10 WhatsApp accounts', 'A/B testing', 'API access'],
    enterprise: ['Unlimited messages', 'Unlimited accounts', 'Custom integrations', 'SLA guarantee'],
  };
  const plan = org?.subscription_plan || 'free';

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="sec-h">
        <div><div className="sec-t">Settings</div><div className="sec-s">Organization configuration</div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Org details */}
        <div className="card">
          <div className="card-h"><div className="card-t">Organization Details</div></div>
          <div className="card-b">
            {loading ? <div className="spinner" /> : (
              <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="fg">
                  <label className="fl">Organization Name *</label>
                  <input className="fi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!isRole('super_admin')} required />
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Domain</label>
                  <input className="fi" placeholder="yourcompany.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} disabled={!isRole('super_admin')} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', marginTop: 3 }}>Used to identify team members by email domain.</div>
                </div>
                {isRole('super_admin') && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button type="submit" className="btn bp" disabled={saving}>{saving ? '⟳' : 'Save Changes'}</button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Plan */}
        <div className="card">
          <div className="card-h">
            <div className="card-t">Subscription Plan</div>
            <span className={`badge b-sending`} style={{ textTransform: 'capitalize' }}>{plan}</span>
          </div>
          <div className="card-b">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: plan !== 'enterprise' ? 14 : 0 }}>
              {(PLAN_FEATURES[plan] || PLAN_FEATURES.free).map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 800, fontSize: 11 }}>✓</span>
                  <span style={{ color: 'var(--tx2)' }}>{f}</span>
                </div>
              ))}
            </div>
            {plan !== 'enterprise' && (
              <div style={{ padding: '12px 14px', background: 'rgba(108,71,255,.06)', border: '1px solid rgba(108,71,255,.15)', borderRadius: 9 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 3 }}>Need more capacity?</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--tx4)' }}>Contact us to upgrade your plan.</div>
              </div>
            )}
          </div>
        </div>

        {/* Danger zone */}
        {isRole('super_admin') && (
          <div className="card" style={{ border: '1px solid rgba(248,113,113,.2)' }}>
            <div className="card-h"><div className="card-t" style={{ color: 'var(--red)' }}>Danger Zone</div></div>
            <div className="card-b">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bdr)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Export all data</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--tx4)' }}>Download all campaigns, contacts and analytics</div>
                </div>
                <button className="btn bs bsm" onClick={() => toast('Data export coming soon', { icon: '📦' })}>Export</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Deactivate organization</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--tx4)' }}>Pause all campaigns and disable access</div>
                </div>
                <button className="btn bd bsm" onClick={() => toast.error('Contact support to deactivate your organization.')}>Deactivate</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
