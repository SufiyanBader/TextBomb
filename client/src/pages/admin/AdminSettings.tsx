import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import MetaApiTab from './components/MetaApiTab';
import SendingTab from './components/SendingTab';
import NotificationsTab from './components/NotificationsTab';
import BrandingTab from './components/BrandingTab';
import api from '../../utils/api';

export default function AdminSettings() {
  const [tab, setTab] = useState('meta');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/org-settings');
      setSettings(data);
    } catch (err: any) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates: any) => {
    setSaving(true);
    try {
      const { data } = await api.put('/org-settings', { ...settings, ...updates });
      setSettings(data);
      toast.success('Settings saved securely');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page act"><div className="empty"><div className="spinner"/></div></div>;

  return (
    <div className="page act">
      <div className="sec-h">
        <div>
          <div className="sec-t">Global Admin Settings</div>
          <div className="sec-s">Manage core API credentials, platform limits, and branding overrides.</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'meta' ? 'act' : ''}`} onClick={() => setTab('meta')}>Meta API</button>
        <button className={`tab ${tab === 'sending' ? 'act' : ''}`} onClick={() => setTab('sending')}>Sending Engine</button>
        <button className={`tab ${tab === 'notifications' ? 'act' : ''}`} onClick={() => setTab('notifications')}>Notifications</button>
        <button className={`tab ${tab === 'branding' ? 'act' : ''}`} onClick={() => setTab('branding')}>Branding</button>
      </div>

      <div className="card">
        {tab === 'meta' && <MetaApiTab settings={settings} onSave={handleSave} saving={saving} />}
        {tab === 'sending' && <SendingTab settings={settings} onSave={handleSave} saving={saving} />}
        {tab === 'notifications' && <NotificationsTab settings={settings} onSave={handleSave} saving={saving} />}
        {tab === 'branding' && <BrandingTab settings={settings} onSave={handleSave} saving={saving} />}
      </div>
    </div>
  );
}
