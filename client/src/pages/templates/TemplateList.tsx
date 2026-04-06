import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const STATUS_CLASS: Record<string,string> = { approved:'b-approved', pending:'b-pending', rejected:'b-rejected', draft:'b-draft', paused:'b-paused' };
const CAT_ICON: Record<string,string> = { MARKETING:'🎯', UTILITY:'🔔', AUTHENTICATION:'🔐' };

export default function TemplateList() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [submitting, setSubmitting] = useState<string|null>(null);

  useEffect(() => {
    const p = filter !== 'all' ? `?status=${filter}` : '';
    api.get(`/templates${p}`).then(r => setTemplates(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const submit = async (id: string) => {
    setSubmitting(id);
    try {
      await api.post(`/templates/${id}/submit`);
      setTemplates(ts => ts.map(t => t.id === id ? { ...t, approval_status: 'pending' } : t));
      toast.success('Submitted to Meta for approval');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Submission failed'); }
    finally { setSubmitting(null); }
  };

  const del = async (id: string) => {
    const t = templates.find(t => t.id === id);
    if (!window.confirm(`Delete "${t?.name}"?`)) return;
    try { await api.delete(`/templates/${id}`); setTemplates(ts => ts.filter(t => t.id !== id)); toast.success('Deleted'); }
    catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const filtered = templates;

  return (
    <div>
      <div className="sec-h">
        <div>
          <div className="sec-t">Templates</div>
          <div className="sec-s">Meta-approved message templates</div>
        </div>
        <Link to="/templates/new" className="btn bp">+ New Template</Link>
      </div>

      <div className="ibox ib" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
        💡 All templates must be approved by Meta before use in campaigns. Approval typically takes 24–72 hours.
      </div>

      <div className="tabs">
        {['all','approved','pending','draft','rejected'].map(s => (
          <button key={s} className={`tab ${filter === s ? 'act' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 180, borderRadius: 'var(--rl)', background: 'var(--bg2)', border: '1px solid var(--bdr)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty">
          <div className="empty-ic">📋</div>
          <h3 className="empty-t">No templates found</h3>
          <p className="empty-d">Create a template and submit it to Meta for approval.</p>
          <Link to="/templates/new" className="btn bp" style={{ marginTop: 10 }}>Create Template</Link>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {filtered.map(t => (
            <div key={t.id} className="card">
              <div style={{ height: 64, background: 'linear-gradient(135deg,var(--bg3),var(--bg4))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', borderBottom: '1px solid var(--bdr)' }}>
                {CAT_ICON[t.category] || '📧'}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', fontFamily: 'DM Mono,monospace' }}>{t.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', marginTop: 2 }}>{t.category} · {t.language} · v{t.version || 1}</div>
                  </div>
                  <span className={`badge ${STATUS_CLASS[t.approval_status] || 'b-draft'}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>
                    {t.approval_status}
                  </span>
                </div>
                {t.preview_text && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--tx3)', marginBottom: 10, height: 34, overflow: 'hidden' }}>
                    {t.preview_text.slice(0, 80)}{t.preview_text.length > 80 ? '…' : ''}
                  </div>
                )}
                {t.rejection_reason && (
                  <div className="ibox ir" style={{ fontSize: '0.72rem', padding: '5px 8px', marginBottom: 8 }}>
                    ❌ {t.rejection_reason.slice(0, 60)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(t.approval_status === 'draft' || t.approval_status === 'rejected') && (
                    <button className="btn bs bsm" onClick={() => submit(t.id)} disabled={submitting === t.id}>
                      {submitting === t.id ? '⟳' : '→ Submit'}
                    </button>
                  )}
                  <button className="btn bd bsm" onClick={() => del(t.id)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
