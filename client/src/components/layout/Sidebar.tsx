import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function Sidebar() {
  const { user, org, logout, isRole } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  React.useEffect(() => {
    if (!org) return;
    const fetchUnread = async () => {
      try {
        const res = await api.get('/conversations/unread-count');
        if (res.data.unreadCount !== undefined) setUnreadCount(res.data.unreadCount);
      } catch (err) {}
    };
    fetchUnread();
    const int = setInterval(fetchUnread, 15000); // Poll 15s
    return () => clearInterval(int);
  }, [org]);

  const handleLogout = async () => { setLoggingOut(true); try { await logout(); } catch { setLoggingOut(false); } };
  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const ni = (path: string, icon: string, label: string, badgeCount?: number) => (
    <NavLink key={path} to={path} style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 10px', borderRadius: 7, fontSize: 13,
      fontWeight: isActive ? 600 : 500,
      color: isActive ? '#fff' : 'rgba(255,255,255,.48)',
      background: isActive ? 'rgba(255,255,255,.09)' : 'transparent',
      textDecoration: 'none', transition: 'all .15s', marginBottom: 1,
      position: 'relative' as const,
      borderLeft: isActive ? '3px solid #fff' : '3px solid transparent',
    })}>
      <span style={{ width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</span>
      {label}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </NavLink>
  );

  return (
    <div id="sidebar">
      <div className="s-logo">
        <div className="s-logo-brand">
          <img src="/logo.png" alt="TextBomb logo" className="s-logo-icon" />
          <div>
            <div className="s-logo-name">TextBomb</div>
            <div className="s-logo-sub">WhatsApp Platform</div>
          </div>
        </div>
        {org && <div style={{ fontSize: '0.7rem', color: 'var(--tx4)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--bdr)' }}>🏢 {org.name}</div>}
      </div>

      <div className="s-nav">
        <div className="nav-sec">Platform</div>
        {ni('/dashboard', '◧', 'Dashboard')}
        {ni('/inbox', '📥', 'Inbox', unreadCount)}
        {ni('/campaigns', '📨', 'Campaigns')}
        {ni('/templates', '📋', 'Templates')}
        {ni('/contacts', '👥', 'Contacts')}

        {isRole('super_admin') && (
          <>
            <div className="nav-sec">Admin</div>
            {ni('/admin/number-pool', '📱', 'Number Pool')}
            {ni('/accounts', '🔑', 'WA Accounts')}
          </>
        )}

        <div className="nav-sec">Analytics</div>
        {ni('/analytics', '📊', 'Analytics')}

        {isRole('super_admin', 'dept_admin') && (
          <>
            <div className="nav-sec">Organization</div>
            {ni('/org/departments', '🏢', 'Departments')}
            {ni('/org/members', '👤', 'Members')}
          </>
        )}

        {isRole('super_admin') && (
          <>
            <div className="nav-sec">Super Admin</div>
            {ni('/admin/settings', '⚙️', 'Global Settings')}
          </>
        )}
      </div>

      <div className="s-user">
        <div className="s-user-inner" onClick={handleLogout} title="Sign out">
          <div className="s-user-av">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="s-user-name">{user?.name}</div>
            <div className="s-user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--tx4)' }}>{loggingOut ? '⟳' : '⇥'}</span>
        </div>
      </div>
    </div>
  );
}
