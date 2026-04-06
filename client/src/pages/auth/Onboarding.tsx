import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const STEPS = ['Connect Number', 'Create Department', 'Add Member'];

export default function Onboarding() {
  const { user, org } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [waForm, setWaForm] = useState({ phone_number_id: '', api_key: '', display_name: '', bsp: 'meta_direct', waba_id: '' });
  const [deptName, setDeptName] = useState('');
  const [member, setMember] = useState({ name: '', email: '', password: '', role: 'member' });
  const [showKey, setShowKey] = useState(false);

  const connectWA = async () => {
    if (!waForm.phone_number_id || !waForm.api_key || !waForm.display_name) { toast.error('Fill all required fields'); return; }
    setLoading(true);
    try {
      await api.post('/number-pool/add', { ...waForm, is_pooled: true, monthly_limit: 10000 });
      toast.success('WhatsApp number added to pool!');
      setStep(1);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const createDept = async () => {
    if (!deptName.trim()) { toast.error('Department name required'); return; }
    setLoading(true);
    try {
      await api.post('/departments', { name: deptName });
      toast.success('Department created!');
      setStep(2);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const addMember = async () => {
    if (!member.email || !member.name || !member.password) { toast.error('Fill all fields'); return; }
    setLoading(true);
    try {
      await api.post('/users/add', member);
      toast.success('Member added! Setup complete 🎉');
      navigate('/dashboard');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 540, animation: 'fadeUp .3s ease' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#6c47ff,#2dd4bf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#fff', fontFamily: 'Manrope,sans-serif', margin: '0 auto 16px', boxShadow: '0 0 32px rgba(108,71,255,.4)' }}>T</div>
          <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>
            Welcome, {user?.name?.split(' ')[0]}! 🎉
          </h1>
          <p style={{ color: 'var(--tx4)', fontSize: '0.875rem' }}>
            Let's set up <strong style={{ color: 'var(--tx2)' }}>{org?.name}</strong> in 3 quick steps
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i < step ? 'var(--teal)' : i === step ? '#fff' : 'rgba(255,255,255,.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  color: i < step ? '#0a0a0a' : i === step ? '#000' : 'var(--tx4)',
                  transition: 'all .3s',
                }}>{i < step ? '✓' : i + 1}</div>
                <span style={{ fontSize: '0.78rem', color: i === step ? 'var(--tx1)' : 'var(--tx4)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: i < step ? 'var(--teal)' : 'var(--bdr)', maxWidth: 40, transition: 'background .3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="card" style={{ borderColor: 'var(--bdr2)' }}>
          <div className="card-b" style={{ padding: 28 }}>

            {/* Step 0: WA Number */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ marginBottom: 4 }}>
                  <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>Connect a WhatsApp Business Number</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--tx4)' }}>You need a Meta Business account with WhatsApp API access. Get your Phone Number ID from the Meta Developer Console.</p>
                </div>
                <div className="fi2">
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">Phone Number ID *</label>
                    <input className="fi" placeholder="From Meta Console" value={waForm.phone_number_id}
                      onChange={e => setWaForm(f => ({ ...f, phone_number_id: e.target.value }))} />
                  </div>
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">Display Name *</label>
                    <input className="fi" placeholder="My Business Line" value={waForm.display_name}
                      onChange={e => setWaForm(f => ({ ...f, display_name: e.target.value }))} />
                  </div>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Access Token *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="fi" type={showKey ? 'text' : 'password'} placeholder="Permanent access token" value={waForm.api_key}
                      onChange={e => setWaForm(f => ({ ...f, api_key: e.target.value }))} style={{ paddingRight: 38 }} />
                    <span onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--tx4)', fontSize: 12 }}>
                      {showKey ? '🙈' : '👁'}
                    </span>
                  </div>
                </div>
                <div className="fi2">
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">WABA ID (optional)</label>
                    <input className="fi" placeholder="Business Account ID" value={waForm.waba_id}
                      onChange={e => setWaForm(f => ({ ...f, waba_id: e.target.value }))} />
                  </div>
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">Provider</label>
                    <select className="fi" value={waForm.bsp} onChange={e => setWaForm(f => ({ ...f, bsp: e.target.value }))}>
                      <option value="meta_direct">Meta Direct</option>
                      <option value="twilio">Twilio</option>
                      <option value="360dialog">360dialog</option>
                      <option value="gupshup">Gupshup</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn bs" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/dashboard')}>Skip for now</button>
                  <button className="btn bp" style={{ flex: 2, justifyContent: 'center' }} onClick={connectWA} disabled={loading}>
                    {loading ? '⟳ Connecting…' : 'Add to Pool →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Department */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>Create your first Department</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--tx4)' }}>Departments organize your team and control which WhatsApp numbers they can use.</p>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Department Name</label>
                  <input className="fi" placeholder="e.g. Marketing, Sales, Support" value={deptName}
                    onChange={e => setDeptName(e.target.value)} autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn bs" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/dashboard')}>Skip</button>
                  <button className="btn bp" style={{ flex: 2, justifyContent: 'center' }} onClick={createDept} disabled={loading}>
                    {loading ? '⟳ Creating…' : 'Create Department →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Member */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>Invite a Team Member</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--tx4)' }}>Add your first teammate. You can invite more from the Members page.</p>
                </div>
                <div className="fi2">
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">Name</label>
                    <input className="fi" placeholder="Jane Smith" value={member.name}
                      onChange={e => setMember(m => ({ ...m, name: e.target.value }))} autoFocus />
                  </div>
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">Role</label>
                    <select className="fi" value={member.role} onChange={e => setMember(m => ({ ...m, role: e.target.value }))}>
                      <option value="member">Member</option>
                      <option value="dept_admin">Dept Admin</option>
                    </select>
                  </div>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Email</label>
                  <input className="fi" type="email" placeholder="jane@company.com" value={member.email}
                    onChange={e => setMember(m => ({ ...m, email: e.target.value }))} />
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <label className="fl">Temporary Password</label>
                  <input className="fi" type="password" placeholder="Min 8 characters" value={member.password}
                    onChange={e => setMember(m => ({ ...m, password: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn bs" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/dashboard')}>Skip</button>
                  <button className="btn bp" style={{ flex: 2, justifyContent: 'center' }} onClick={addMember} disabled={loading}>
                    {loading ? '⟳ Adding…' : 'Add Member & Finish →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
