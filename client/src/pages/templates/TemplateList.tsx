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

  const del = async (id: string, fromMeta = false) => {
    const t = templates.find(t => t.id === id);
    if (!window.confirm(`Delete "${t?.name}"${fromMeta ? ' globally from Meta entirely' : ''}?`)) return;
    try { 
      if (fromMeta) await api.delete(`/templates/${id}/meta`);
      else await api.delete(`/templates/${id}`); 
      setTemplates(ts => ts.filter(t => t.id !== id)); 
      toast.success('Deleted'); 
    }
    catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const syncStatus = async (id: string) => {
    setSubmitting(`sync_${id}`);
    try {
      const { data } = await api.post(`/templates/${id}/sync-status`);
      setTemplates(ts => ts.map(t => t.id === id ? { ...t, ...data } : t));
      toast.success('Synced with Meta');
    } catch (err: any) { toast.error('Failed to sync'); }
    finally { setSubmitting(null); }
  };

  const duplicate = async (id: string) => {
    try {
      const { data } = await api.post(`/templates/${id}/duplicate`);
      setTemplates([data, ...templates]);
      toast.success('Duplicated as new draft');
    } catch (err: any) { toast.error('Failed to duplicate'); }
  };

  const syncAll = async () => {
    const pending = templates.filter(t => t.approval_status === 'pending');
    for (const p of pending) await syncStatus(p.id);
    toast.success('Batch sync complete');
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
        {['all','approved','pending','draft','rejected', 'approval-center'].map(s => (
          <button key={s} className={`tab ${filter === s ? 'act' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s === 'approval-center' ? 'Approval Center 🔔' : s.charAt(0).toUpperCase() + s.slice(1)}
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
      ) : filter === 'approval-center' ? (
        <div style={{ maxWidth: 700 }}>
          <div className="flex jsb fac mb14">
            <div style={{ fontWeight: 800 }}>PENDING META REVIEW</div>
            <button className="btn bg_" onClick={syncAll}>🔄 Sync Pending from Meta</button>
          </div>
          {filtered.filter(t => t.approval_status === 'pending').map(t => (
            <div key={t.id} className="card mb14" style={{ borderLeft: '4px solid var(--yellow)', padding: '12px 14px' }}>
              <div className="flex jsb">
                <div style={{ fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>{t.name}</div>
                <div className="muted">{t.category} · {t.language} · v{t.version || 1}</div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button className="btn bs bsm" onClick={() => syncStatus(t.id)} disabled={submitting === `sync_${t.id}`}>
                  {submitting === `sync_${t.id}` ? '⟳' : '🔄 Sync Status'}
                </button>
                <button className="btn bd bsm" onClick={() => del(t.id, true)}>🗑 Withdraw</button>
              </div>
            </div>
          ))}

          <div style={{ fontWeight: 800, marginTop: 30, marginBottom: 14 }}>REJECTED - NEEDS ATTENTION</div>
          {filtered.filter(t => t.approval_status === 'rejected').map(t => (
            <div key={t.id} className="card mb14" style={{ borderLeft: '4px solid var(--red)', padding: '12px 14px' }}>
              <div className="flex jsb">
                <div style={{ fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>{t.name}</div>
                <div className="muted">{t.category} · {t.language} · v{t.version || 1}</div>
              </div>
              <div className="muted" style={{ margin: '8px 0', color: 'var(--red)' }}>❌ {t.rejection_reason || 'Rejected by Meta policies'}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button className="btn bp bsm" onClick={() => duplicate(t.id)}>📋 Duplicate & Fix</button>
                <button className="btn bd bsm" onClick={() => del(t.id, true)}>🗑 Delete</button>
              </div>
            </div>
          ))}
          
          <div style={{ fontWeight: 800, marginTop: 30, marginBottom: 14 }}>APPROVED - READY TO USE</div>
          <div className="g2">
            {filtered.filter(t => t.approval_status === 'approved').map(t => (
              <div key={t.id} className="card" style={{ borderLeft: '4px solid var(--green)', padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>{t.name} ✅</div>
                <div className="muted" style={{ marginTop: 6 }}>{t.category} · {t.language} · v{t.version || 1}</div>
              </div>
            ))}
          </div>
        </div>
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
