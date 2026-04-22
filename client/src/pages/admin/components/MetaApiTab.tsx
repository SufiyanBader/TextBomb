import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

export default function MetaApiTab({ settings, onSave, saving }: any) {
  const [form, setForm] = useState({
    meta_app_id: settings.meta_app_id || '',
    meta_app_secret: '', // Empty initially due to encrypted status
    meta_webhook_verify_token: settings.meta_webhook_verify_token || '',
    meta_graph_api_version: settings.meta_graph_api_version || 'v18.0'
  });
  
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/org-settings/test-meta');
      toast.success(`Connection successful! Connected to: ${data.account_name}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="fi2">
        <div className="fg">
          <label className="fl">Meta App ID</label>
          <input type="text" className="fi" value={form.meta_app_id} onChange={e => setForm({...form, meta_app_id: e.target.value})} placeholder="e.g. 10293848576" />
        </div>
        <div className="fg">
          <label className="fl">
            Meta App Secret {settings.meta_app_secret_set && <span className="badge b-approved" style={{ marginLeft: 6 }}>● SET</span>}
          </label>
          <input type="password" className="fi" value={form.meta_app_secret} onChange={e => setForm({...form, meta_app_secret: e.target.value})} placeholder={settings.meta_app_secret_set ? "•••••••• (Will Override)" : "Secret Key"} />
        </div>
      </div>
      
      <div className="fi2">
        <div className="fg">
          <label className="fl">Webhook Verify Token</label>
          <input type="password" className="fi" value={form.meta_webhook_verify_token} onChange={e => setForm({...form, meta_webhook_verify_token: e.target.value})} />
        </div>
        <div className="fg">
          <label className="fl">Graph API Version</label>
          <select className="fi" value={form.meta_graph_api_version} onChange={e => setForm({...form, meta_graph_api_version: e.target.value})}>
            <option value="v18.0">v18.0</option>
            <option value="v19.0">v19.0</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button className="btn bg_" onClick={testConnection} disabled={testing}>{testing ? 'Testing...' : '🔌 Test Meta Graph Connection'}</button>
        <button className="btn bp" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Saving...' : 'Save Meta Configuration'}</button>
      </div>
    </div>
  );
}
