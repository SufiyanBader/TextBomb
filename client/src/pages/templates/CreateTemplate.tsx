import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = ['en_US', 'en_GB', 'es_ES', 'pt_BR', 'fr_FR', 'de_DE', 'ar', 'hi', 'id'];

export default function CreateTemplate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'MARKETING', language: 'en_US' });
  const [header, setHeader] = useState({ enabled: false, text: '' });
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState({ enabled: false, text: '' });
  const [buttons, setButtons] = useState<{ type: string; text: string; url?: string }[]>([]);

  const addButton = () => { if (buttons.length >= 3) { toast.error('Max 3 buttons'); return; } setButtons(b => [...b, { type: 'QUICK_REPLY', text: '' }]); };

  const buildComponents = () => {
    const comps: any[] = [];
    if (header.enabled && header.text) comps.push({ type: 'HEADER', format: 'TEXT', text: header.text });
    if (body) comps.push({ type: 'BODY', text: body });
    if (footer.enabled && footer.text) comps.push({ type: 'FOOTER', text: footer.text });
    if (buttons.filter(b => b.text).length > 0) comps.push({ type: 'BUTTONS', buttons: buttons.filter(b => b.text) });
    return comps;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) { toast.error('Body text is required'); return; }
    if (!form.name.match(/^[a-z0-9_]+$/)) { toast.error('Name must be lowercase letters, numbers, underscores only'); return; }
    const components_json = buildComponents();
    setLoading(true);
    try {
      await api.post('/templates', { ...form, components_json, preview_text: body.slice(0, 100) });
      toast.success('Template created! Submit it to Meta for approval.');
      navigate('/templates');
    } catch (err: any) { toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed'); }
    finally { setLoading(false); }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <div className={`toggle ${value ? 'on' : ''}`} onClick={onChange} />
  );

  const previewBody = body.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Var ${n}]`);

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="sec-h">
        <div><div className="sec-t">New Template</div><div className="sec-s">Build a WhatsApp message template for Meta approval</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Info */}
          <div className="card">
            <div className="card-h"><div className="card-t">Template Info</div></div>
            <div className="card-b">
              <div className="fg">
                <label className="fl">Template Name *</label>
                <input className="fi" placeholder="e.g. order_confirmation (lowercase, underscores)" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} required autoFocus />
                <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', marginTop: 3 }}>Used as identifier in Meta. Cannot be changed after creation.</div>
              </div>
              <div className="fi2">
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Category *</label>
                  <select className="fi" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Language *</label>
                  <select className="fi" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="card">
            <div className="card-h">
              <div><div className="card-t">Header</div><div className="card-sub">Optional. Shown above the body.</div></div>
              <Toggle value={header.enabled} onChange={() => setHeader(h => ({ ...h, enabled: !h.enabled }))} />
            </div>
            {header.enabled && (
              <div className="card-b">
                <input className="fi" placeholder="Header text (supports {{1}} variable)" value={header.text} onChange={e => setHeader(h => ({ ...h, text: e.target.value }))} />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="card">
            <div className="card-h"><div className="card-t">Body *</div></div>
            <div className="card-b">
              <textarea className="fi" rows={5} style={{ resize: 'vertical' }}
                placeholder={`Hi {{1}}, your order #{{2}} has been confirmed!\n\nUse {{1}}, {{2}} for variable placeholders.`}
                value={body} onChange={e => setBody(e.target.value)} required />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--tx4)' }}>Use {'{{1}}'}, {'{{2}}'} for personalization</span>
                <span style={{ fontSize: '0.7rem', color: body.length > 1024 ? 'var(--red)' : 'var(--tx4)' }}>{body.length}/1024</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="card">
            <div className="card-h">
              <div><div className="card-t">Footer</div><div className="card-sub">Shown below body in smaller text.</div></div>
              <Toggle value={footer.enabled} onChange={() => setFooter(f => ({ ...f, enabled: !f.enabled }))} />
            </div>
            {footer.enabled && (
              <div className="card-b">
                <input className="fi" placeholder="e.g. Reply STOP to unsubscribe" value={footer.text} onChange={e => setFooter(f => ({ ...f, text: e.target.value }))} />
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="card">
            <div className="card-h">
              <div><div className="card-t">Buttons</div><div className="card-sub">Optional. Up to 3 buttons.</div></div>
              <button type="button" className="btn bs bsm" onClick={addButton}>+ Add</button>
            </div>
            {buttons.length > 0 && (
              <div className="card-b">
                {buttons.map((btn, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 8, alignItems: 'center' }}>
                    <select className="fi" style={{ width: 130, flex: 'none' }} value={btn.type}
                      onChange={e => setButtons(bs => bs.map((b, j) => j === i ? { ...b, type: e.target.value } : b))}>
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">URL Link</option>
                      <option value="PHONE_NUMBER">Phone</option>
                    </select>
                    <input className="fi" placeholder="Button label" value={btn.text}
                      onChange={e => setButtons(bs => bs.map((b, j) => j === i ? { ...b, text: e.target.value } : b))} />
                    {btn.type === 'URL' && (
                      <input className="fi" placeholder="https://…" value={btn.url || ''}
                        onChange={e => setButtons(bs => bs.map((b, j) => j === i ? { ...b, url: e.target.value } : b))} />
                    )}
                    <button type="button" className="btn bd bsm" style={{ padding: 6, flexShrink: 0 }}
                      onClick={() => setButtons(bs => bs.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn bs" onClick={() => navigate('/templates')}>Cancel</button>
            <button type="submit" className="btn bp" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? '⟳' : 'Create Template'}
            </button>
          </div>
        </form>

        {/* Live Preview */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tx4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Preview</div>
          <div style={{ background: '#0b1418', borderRadius: 14, padding: 18, border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ background: '#1f2c34', borderRadius: '8px 8px 8px 0', padding: '10px 12px', maxWidth: '90%', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }}>
              {header.enabled && header.text && (
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 5, color: '#fff' }}>
                  {header.text.replace(/\{\{1\}\}/g, '[Var]')}
                </div>
              )}
              <div style={{ fontSize: '0.825rem', lineHeight: 1.5, color: '#d1d7db', whiteSpace: 'pre-wrap' }}>
                {previewBody || <span style={{ opacity: .4 }}>Your message body…</span>}
              </div>
              {footer.enabled && footer.text && (
                <div style={{ fontSize: '0.7rem', color: '#667781', marginTop: 6, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 5 }}>
                  {footer.text}
                </div>
              )}
              <div style={{ fontSize: '0.62rem', color: '#667781', textAlign: 'right', marginTop: 3 }}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
            {buttons.filter(b => b.text).map((btn, i) => (
              <div key={i} style={{ background: '#1f2c34', borderRadius: 8, padding: '9px 12px', marginTop: 4, fontSize: '0.825rem', color: '#00a884', textAlign: 'center' }}>
                {btn.type === 'URL' ? '🔗 ' : btn.type === 'PHONE_NUMBER' ? '📞 ' : '↩ '}{btn.text}
              </div>
            ))}
          </div>
          <div className="ibox iy" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.75rem' }}>
            After creating, submit to Meta for approval. Only approved templates can be used in campaigns.
          </div>
        </div>
      </div>
    </div>
  );
}
