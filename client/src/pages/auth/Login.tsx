import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg1)', display: 'flex', overflow: 'auto' }}>
      {/* Left panel */}
      <div style={{
        width: 440, minHeight: '100vh', background: 'var(--bg0)',
        borderRight: '1px solid var(--bdr)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px', flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,71,255,.06) 0,transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 280 }}>
          {/* Logo */}
          <img src="/logo.png" alt="TextBomb logo" style={{ width: 56, height: 56, borderRadius: 14, display: 'block', margin: '0 auto 20px', objectFit: 'cover', boxShadow: '0 0 40px rgba(108,71,255,.4)' }} />
          <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.3rem', marginBottom: 4 }}>TextBomb</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--tx4)', letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 32 }}>WhatsApp Business Platform</div>

          <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,.12)', margin: '0 auto 24px' }} />

          {/* Feature list */}
          {[
            'Multi-department number management',
            'Compliant opt-in enforcement',
            'Meta-approved template workflows',
            'Real-time delivery analytics',
            'Role-based access control',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,.05)', borderRadius: 7, background: 'rgba(255,255,255,.02)', marginBottom: 7, textAlign: 'left' }}>
              <span style={{ color: 'var(--teal)', fontWeight: 800, fontSize: 11 }}>✓</span>
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: 400, animation: 'fadeUp .3s ease' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.5rem', marginBottom: 6 }}>Welcome back</h1>
            <p style={{ color: 'var(--tx4)', fontSize: '0.875rem' }}>Sign in to your organization</p>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Email Address</label>
              <input className="fi" type="email" placeholder="you@company.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="fi" type={showPass ? 'text' : 'password'} placeholder="Your password"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingRight: 38 }} required />
                <span onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--tx4)', fontSize: 12 }}>
                  {showPass ? '🙈' : '👁'}
                </span>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px 20px', background: '#fff', color: '#000',
              border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1,
              fontFamily: 'DM Sans,sans-serif', transition: 'all .15s', marginTop: 4,
            }}>
              {loading ? '⟳ Signing in…' : 'Sign In →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--tx4)' }}>
            No account?{' '}
            <Link to="/signup" style={{ color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>
              Create your organization →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
