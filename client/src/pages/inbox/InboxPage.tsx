import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConversationPanel from './ConversationPanel';

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchConversations(); }, [filter]);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get(`/conversations?status=${filter}`);
      setConversations(data);
    } catch { toast.error('Failed to load inbox'); }
    finally { setLoading(false); }
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setConversations(cvs => cvs.map(c => c.id === id ? { ...c, unread_count: 0 } : c));
  };

  return (
    <div className="page" style={{ padding: 0, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Thread List Sidebar */}
      <div style={{ width: 350, borderRight: '1px solid var(--bdr)', background: 'var(--bg1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Inbox</h2>
        </div>
        
        <div className="tabs" style={{ padding: '0 20px' }}>
          {['open', 'pending', 'resolved'].map(s => (
            <button key={s} className={`tab ${filter === s ? 'act' : ''}`} onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--tx3)' }}>Loading...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--tx3)' }}>No {filter} conversations</div>
          ) : (
            conversations.map(c => (
              <div 
                key={c.id} 
                onClick={() => handleSelect(c.id)}
                style={{
                  padding: 14, borderRadius: 12, cursor: 'pointer', marginBottom: 4,
                  background: activeId === c.id ? 'var(--bg3)' : 'transparent',
                  transition: 'background 0.1s',
                  display: 'flex', gap: 12, position: 'relative'
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg4)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {c.Contact?.first_name?.[0] || c.Contact?.phone_number?.replace(/\D/g, '')?.[0] || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex jsb fac" style={{ marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.Contact?.first_name} {c.Contact?.last_name || c.Contact?.phone_number}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--tx3)' }}>
                      {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.Contact?.phone_number}
                  </div>
                </div>
                {c.unread_count > 0 && (
                  <div style={{ position: 'absolute', top: 18, right: 14, background: 'var(--cyan)', color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: 10 }}>
                    {c.unread_count}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div style={{ flex: 1, background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
        {activeId ? (
          <ConversationPanel conversationId={activeId} onStatusChange={fetchConversations} />
        ) : (
          <div className="empty" style={{ margin: 'auto' }}>
            <div className="empty-ic" style={{ fontSize: 40, opacity: 0.5 }}>💬</div>
            <h3 className="empty-t">Select a conversation</h3>
            <p className="empty-d">Choose a thread from the list to view the chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
