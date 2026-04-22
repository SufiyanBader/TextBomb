import React, { useState } from 'react';

export default function SendingTab({ settings, onSave, saving }: any) {
  const [form, setForm] = useState({
    default_batch_size: settings.default_batch_size || 25,
    default_delay_min: settings.default_delay_min || 2,
    default_delay_max: settings.default_delay_max || 8,
    spam_words: settings.spam_words || ''
  });

  return (
    <div style={{ padding: 20 }}>
      <div className="fi3">
        <div className="fg">
          <label className="fl">Batch Size <span className="muted">({form.default_batch_size})</span></label>
          <input type="range" min="5" max="100" className="fi" value={form.default_batch_size} onChange={e => setForm({...form, default_batch_size: parseInt(e.target.value)})} />
        </div>
        <div className="fg">
          <label className="fl">Minimum Delay (s)</label>
          <input type="number" className="fi" value={form.default_delay_min} onChange={e => setForm({...form, default_delay_min: parseInt(e.target.value)})} />
        </div>
        <div className="fg">
          <label className="fl">Maximum Delay (s)</label>
          <input type="number" className="fi" value={form.default_delay_max} onChange={e => setForm({...form, default_delay_max: parseInt(e.target.value)})} />
        </div>
      </div>

      <div className="fg">
        <label className="fl">Spam Filtering Words (comma separated)</label>
        <textarea className="fi" value={form.spam_words} onChange={e => setForm({...form, spam_words: e.target.value})} placeholder="FREE,WINNER,URGENT" style={{ height: 60 }} />
      </div>

      <button className="btn bp" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Saving...' : 'Save Engine Config'}</button>
    </div>
  );
}
