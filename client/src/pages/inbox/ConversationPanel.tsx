import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

export default function ConversationPanel({ conversationId, onStatusChange }: { conversationId: string, onStatusChange: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChat();
    // Poll for new messages roughly
    const int = setInterval(fetchChat, 10000);
    return () => clearInterval(int);
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.Messages]);

  const fetchChat = async () => {
    try {
      const res = await api.get(`/conversations/${conversationId}`);
      setData(res.data);
    } catch { toast.error('Failed to load chat'); }
    finally { setLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/conversations/${conversationId}/reply`, { message: reply });
      setData({ ...data, Messages: [...(data.Messages || []), res.data] });
      setReply('');
      onStatusChange();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to send message'); }
    finally { setSending(false); }
  };

  const setStatus = async (status: string) => {
    try {
      await api.put(`/conversations/${conversationId}/status`, { status });
      setData({ ...data, status });
      onStatusChange();
      toast.success(`Marked as ${status}`);
    } catch { toast.error('Failed to update status'); }
  };

  if (loading || !data) return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chat header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bdr)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg1)' }}>
        <div className="flex fac" style={{ gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {data.Contact?.first_name?.[0] || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{data.Contact?.first_name} {data.Contact?.last_name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--tx3)' }}>{data.Contact?.phone_number}</div>
          </div>
        </div>
        <div className="flex fac" style={{ gap: 8 }}>
          <select 
            className="fi bsm" 
            value={data.status} 
            onChange={e => setStatus(e.target.value)}
            style={{ width: 120, height: 32, padding: '0 8px' }}
          >
            <option value="open">🟢 Open</option>
            <option value="pending">🟡 Pending</option>
            <option value="resolved">⚪ Resolved</option>
          </select>
        </div>
      </div>

      {/* Chat history */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.Messages?.map((m: any) => {
          const isOut = m.direction === 'outbound';
          return (
            <div 
              key={m.id} 
              style={{
                alignSelf: isOut ? 'flex-end' : 'flex-start',
                maxWidth: '70%',
                background: isOut ? 'rgba(34,211,238,.2)' : 'var(--bg2)', // Neon Cyan matched brand override!
                border: isOut ? '1px solid rgba(34,211,238,.3)' : '1px solid var(--bdr)',
                borderRadius: 12,
                padding: '10px 14px',
                position: 'relative'
              }}
            >
              <div style={{ fontSize: '0.9rem', lineHeight: 1.4 }} className="chat-md">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              <div style={{ 
                fontSize: '0.65rem', color: isOut ? 'rgba(255,255,255,.5)' : 'var(--tx4)', 
                textAlign: 'right', marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 4
              }}>
                {isOut && m.sender?.name && <span>{m.sender.name} · </span>}
                {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {isOut && <span style={{ marginLeft: 4 }}>{m.status === 'delivered' || m.status === 'read' ? '✓✓' : '✓'}</span>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply input */}
      <form onSubmit={handleSend} style={{ padding: 20, borderTop: '1px solid var(--bdr)', background: 'var(--bg1)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input 
            type="text" 
            className="fi" 
            placeholder="Type a reply... (Markdown supported)" 
            value={reply}
            onChange={e => setReply(e.target.value)}
            disabled={sending}
            style={{ flex: 1, background: 'var(--bg0)' }}
          />
          <button type="submit" className="btn bp" disabled={sending || !reply.trim()}>
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
