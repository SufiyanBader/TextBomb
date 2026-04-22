import React, { useState } from 'react';

export default function NotificationsTab({ settings, onSave, saving }: any) {
  const [form, setForm] = useState({
    notify_on_completion: settings.notify_on_completion ?? true,
    notify_on_failure: settings.notify_on_failure ?? true,
    notify_threshold_pct: settings.notify_threshold_pct || 80
  });

  return (
    <div style={{ padding: 20 }}>
      <div className="flex jsb fac mb14">
        <div>
          <div style={{ fontWeight: 600 }}>Campaign Completion Alert</div>
          <div className="muted">Send notifications when campaigns structurally finish</div>
        </div>
        <div className={`toggle ${form.notify_on_completion ? 'on' : ''}`} onClick={() => setForm({...form, notify_on_completion: !form.notify_on_completion})} />
      </div>

      <div className="flex jsb fac mb20">
        <div>
          <div style={{ fontWeight: 600 }}>High Failure Alert</div>
          <div className="muted">Send warnings if campaigns suffer unusual delivery bounce rates</div>
        </div>
        <div className={`toggle ${form.notify_on_failure ? 'on' : ''}`} onClick={() => setForm({...form, notify_on_failure: !form.notify_on_failure})} />
      </div>

      <div className="fg" style={{ maxWidth: 300 }}>
        <label className="fl">Quota Warning Threshold (%)</label>
        <input type="range" min="50" max="100" className="fi" value={form.notify_threshold_pct} onChange={e => setForm({...form, notify_threshold_pct: parseInt(e.target.value)})} />
        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700 }}>{form.notify_threshold_pct}%</div>
      </div>

      <button className="btn bp" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Saving...' : 'Save Notification Config'}</button>
    </div>
  );
}
