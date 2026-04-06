import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/campaigns': 'Campaigns',
  '/campaigns/new': 'New Campaign',
  '/templates': 'Templates',
  '/templates/new': 'New Template',
  '/contacts': 'Contacts',
  '/contacts/upload': 'Upload Contacts',
  '/contacts/suppression': 'Suppression List',
  '/accounts': 'WA Accounts',
  '/admin/number-pool': 'Number Pool',
  '/analytics': 'Analytics',
  '/org/departments': 'Departments',
  '/org/members': 'Members',
  '/org/settings': 'Settings',
};

export default function Layout() {
  const location = useLocation();

  useEffect(() => {
    const base = '/' + location.pathname.split('/')[1];
    const title = PAGE_TITLES[location.pathname] || PAGE_TITLES[base] || 'TextBomb';
    const el = document.getElementById('pg-title');
    if (el) el.textContent = title;
  }, [location]);

  return (
    <div id="app">
      <Sidebar />
      <div id="main">
        <TopBar />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
