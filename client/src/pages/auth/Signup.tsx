import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function passStrength(v: string) {
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const levels = [
    { w: 0, c: 'transparent', l: '' },
    { w: 20, c: '#f87171', l: 'Weak' },
    { w: 40, c: '#fb923c', l: 'Fair' },
    { w: 60, c: '#facc15', l: 'Good' },
    { w: 80, c: '#4ade80', l: 'Strong' },
    { w: 100, c: '#4ade80', l: 'Very Strong' },
  ];
  return levels[Math.min(s, 5)];
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '', domain: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const strength = passStrength(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signup(form);
      navigate('/onboarding');
    } catch (err: any) {
      const msg = err.code === 'ECONNABORTED' ? 'Connection timed out. Please check your internet or server status.' : (err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Signup failed');
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg1)', display: 'flex', overflow: 'auto' }}>
      {/* Left panel */}
      <div style={{ width: 440, minHeight: '100vh', background: 'var(--bg0)', borderRight: '1px solid var(--bdr)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 48px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(45,212,191,.05) 0,transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 280 }}>
          <img src="/logo.png" alt="TextBomb logo" style={{ width: 56, height: 56, borderRadius: 14, display: 'block', margin: '0 auto 20px', objectFit: 'cover', boxShadow: '0 0 40px rgba(34,211,238,.4)' }} />
          <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.3rem', marginBottom: 4 }}>TextBomb</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--tx4)', letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 32 }}>WhatsApp Business Platform</div>
          <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,.12)', margin: '0 auto 24px' }} />

          <div style={{ background: 'rgba(45,212,191,.06)', border: '1px solid rgba(45,212,191,.15)', borderRadius: 10, padding: '16px 14px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>What you get</div>
            {['One organization, unlimited departments', 'Centralized WhatsApp number pool', 'Team-based number assignment', 'Full campaign analytics', 'Meta-compliant messaging'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: '0.8rem', color: 'var(--tx3)' }}>
                <span style={{ color: 'var(--teal)', fontWeight: 800, fontSize: 10, flexShrink: 0 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: 440, animation: 'fadeUp .3s ease' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.5rem', marginBottom: 6 }}>Create your organization</h1>
            <p style={{ color: 'var(--tx4)', fontSize: '0.875rem' }}>You'll be the Super Admin and can add team members after setup.</p>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Company Name *</label>
              <input className="fi" placeholder="Acme Corp" value={form.companyName} onChange={set('companyName')} required autoFocus />
            </div>

            <div className="fi2">
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Your Name *</label>
                <input className="fi" placeholder="Jane Smith" value={form.name} onChange={set('name')} required />
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Domain (optional)</label>
                <input className="fi" placeholder="acme.com" value={form.domain} onChange={set('domain')} />
              </div>
            </div>

            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Work Email *</label>
              <input className="fi" type="email" placeholder="jane@acme.com" value={form.email} onChange={set('email')} required />
            </div>

            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Password *</label>
              <div style={{ position: 'relative' }}>
                <input className="fi" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                  value={form.password} onChange={set('password')} style={{ paddingRight: 38 }} required />
                <span onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--tx4)', fontSize: 12 }}>
                  {showPass ? '🙈' : '👁'}
                </span>
              </div>
              {form.password && (
                <div style={{ marginTop: 5 }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${strength.w}%`, background: strength.c, transition: 'all .3s', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: strength.c, marginTop: 3 }}>{strength.l}</div>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px 20px', background: '#fff', color: '#000',
              border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1,
              fontFamily: 'DM Sans,sans-serif', transition: 'all .15s', marginTop: 6,
            }}>
              {loading ? '⟳ Creating…' : 'Create Organization →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--tx4)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
