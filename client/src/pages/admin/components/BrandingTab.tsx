import React, { useState } from 'react';

export default function BrandingTab({ settings, onSave, saving }: any) {
  const [form, setForm] = useState({
    unsub_company: settings.unsub_company || '',
    unsub_color: settings.unsub_color || '#22d3ee',
    unsub_message: settings.unsub_message || 'You have successfully opted out from future communications.'
  });

  return (
    <div style={{ padding: 20, display: 'flex', gap: 40, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 300 }}>
        <div className="fg">
          <label className="fl">Outward Brand Target Name</label>
          <input type="text" className="fi" value={form.unsub_company} onChange={e => setForm({...form, unsub_company: e.target.value})} placeholder="Acme Corp" />
        </div>
        
        <div className="fg">
          <label className="fl">Theme Color Target (Hex)</label>
          <div className="flex fac" style={{ gap: 10 }}>
            <input type="color" value={form.unsub_color} onChange={e => setForm({...form, unsub_color: e.target.value})} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, background: 'none' }} />
            <input type="text" className="fi" value={form.unsub_color} onChange={e => setForm({...form, unsub_color: e.target.value})} style={{ width: 120 }} />
          </div>
        </div>

        <div className="fg">
          <label className="fl">Unsubscribe Page Message Text</label>
          <textarea className="fi" value={form.unsub_message} onChange={e => setForm({...form, unsub_message: e.target.value})} style={{ height: 80 }} />
        </div>

        <button className="btn bp" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Saving...' : 'Save Branding'}</button>
      </div>

      <div style={{ width: 320, background: 'var(--bg0)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--bdr)' }}>
        <div style={{ height: 120, background: form.unsub_color || '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#000' }}>{form.unsub_company || 'Your Company'}</div>
        </div>
        <div style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(74,222,128,.1)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 16px' }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Opted Out</div>
          <div className="muted">{form.unsub_message}</div>
        </div>
      </div>
    </div>
  );
}
