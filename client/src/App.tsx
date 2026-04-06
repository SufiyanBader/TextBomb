import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Onboarding from './pages/auth/Onboarding';
import Overview from './pages/dashboard/Overview';
import CampaignList from './pages/campaigns/CampaignList';
import CreateCampaign from './pages/campaigns/CreateCampaign';
import CampaignAnalytics from './pages/campaigns/CampaignAnalytics';
import TemplateList from './pages/templates/TemplateList';
import CreateTemplate from './pages/templates/CreateTemplate';
import ContactLists from './pages/contacts/ContactLists';
import UploadContacts from './pages/contacts/UploadContacts';
import SuppressionList from './pages/contacts/SuppressionList';
import WhatsAppAccounts from './pages/accounts/WhatsAppAccounts';
import NumberPool from './pages/admin/NumberPool';
import Departments from './pages/organization/Departments';
import Members from './pages/organization/Members';
import OrgSettings from './pages/organization/OrgSettings';
import './index.css';

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg1)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--bdr)', borderTopColor: 'rgba(255,255,255,.5)', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '0.8rem', color: 'var(--tx4)' }}>Loading TextBomb…</div>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Public({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,.13)', borderRadius: 9, fontSize: '0.875rem' },
            success: { style: { background: '#0f2d1a', borderColor: 'rgba(74,222,128,.22)', color: '#86efac' } },
            error: { style: { background: '#2d0f0f', borderColor: 'rgba(248,113,113,.22)', color: '#fca5a5' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Public><Login /></Public>} />
          <Route path="/signup" element={<Public><Signup /></Public>} />
          <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />

          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Overview />} />
            <Route path="campaigns" element={<CampaignList />} />
            <Route path="campaigns/new" element={<CreateCampaign />} />
            <Route path="campaigns/:id/analytics" element={<CampaignAnalytics />} />
            <Route path="templates" element={<TemplateList />} />
            <Route path="templates/new" element={<CreateTemplate />} />
            <Route path="contacts" element={<ContactLists />} />
            <Route path="contacts/upload" element={<UploadContacts />} />
            <Route path="contacts/suppression" element={<SuppressionList />} />
            <Route path="accounts" element={<WhatsAppAccounts />} />
            {/* Super Admin Only */}
            <Route path="admin/number-pool" element={<NumberPool />} />
            {/* Org Management */}
            <Route path="org/departments" element={<Departments />} />
            <Route path="org/members" element={<Members />} />
            <Route path="org/settings" element={<OrgSettings />} />
            {/* Analytics shortcut */}
            <Route path="analytics" element={<CampaignAnalytics />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
