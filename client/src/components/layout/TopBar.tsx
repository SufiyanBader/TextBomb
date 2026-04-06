import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

interface Notification { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; }

const TYPE_COLOR: Record<string,string> = { campaign_completed:'var(--green)', high_failure_rate:'var(--red)', number_assigned:'var(--teal)', default:'var(--blue)' };

export default function TopBar() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [npanelOpen, setNpanelOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { logout } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/notifications/unread-count').then(r => setUnread(r.data.count)).catch(() => {});
    const iv = setInterval(() => { api.get('/notifications/unread-count').then(r => setUnread(r.data.count)).catch(() => {}); }, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (npanelOpen && notifs.length === 0) api.get('/notifications').then(r => setNotifs(r.data || [])).catch(() => {});
  }, [npanelOpen]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setNpanelOpen(false); setUserMenuOpen(false); }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const markAllRead = async () => {
    await api.put('/notifications/mark-all-read');
    setUnread(0); setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div id="topbar" ref={ref}>
      <div className="tb-l">
        <div className="tb-title" id="pg-title">Dashboard</div>
        <span className="tb-sep">›</span>
        <span style={{ fontSize: 12, color: 'var(--tx4)' }}>TextBomb</span>
      </div>

      <div className="search-bar">
        <span style={{ color: 'var(--tx4)', fontSize: 13 }}>🔍</span>
        <input type="text" placeholder="Search…" />
      </div>

      <div className="tb-r">
        {/* Bell */}
        <div className="ic-btn" onClick={() => { setNpanelOpen(o => !o); setUserMenuOpen(false); }}>
          🔔
          <div className="npip" style={{ display: unread > 0 ? 'block' : 'none' }} />
        </div>

        {/* User chip */}
        <div className="user-chip" onClick={() => { setUserMenuOpen(o => !o); setNpanelOpen(false); }}>
          <div className="user-av">{initials}</div>
          <span className="user-name">{user?.name?.split(' ')[0]}</span>
          <span style={{ color: 'var(--tx4)', fontSize: 10 }}>▾</span>
        </div>
      </div>

      {/* Notification panel */}
      <div id="npanel" className={npanelOpen ? 'open' : ''}>
        <div className="nhead">
          <span className="nhead-t">Notifications</span>
          {unread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Mark all read</button>}
        </div>
        <div className="nlist">
          {notifs.length === 0
            ? <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--tx4)', fontSize: '0.82rem' }}>No notifications yet</div>
            : notifs.map(n => (
              <div key={n.id} className={`nit ${!n.is_read ? 'unread' : ''}`}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[n.type] || TYPE_COLOR.default, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div className="ntxt">{n.title}</div>
                  <div className="ntxt" style={{ fontSize: '0.75rem', color: 'var(--tx4)' }}>{n.message}</div>
                  <div className="ntime">{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* User menu */}
      <div id="user-menu" style={{ display: userMenuOpen ? 'block' : 'none' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bdr)' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--tx4)' }}>{user?.email}</div>
        </div>
        <div style={{ padding: 6 }}>
          <button className="ni" style={{ borderRadius: 7 }} onClick={logout}>🚪 Sign Out</button>
        </div>
      </div>
    </div>
  );
}
