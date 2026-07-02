
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Send, Mic, Paperclip, User, ShieldCheck, Activity, Calendar, StopCircle, File, Plus, UserCircle, Phone, MessageSquare, X } from 'lucide-react';

export default function DeskChat() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activePatient, setActivePatient] = useState<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUserScrolledUpRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Show "New Chat" dialog
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatInput, setNewChatInput] = useState('');
  const [showMockProfile, setShowMockProfile] = useState(false);

  const hospital = sessionStorage.getItem('nalamHdeskBranch') || localStorage.getItem('nalamHdeskBranch') || 'Apollo Hospital';

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/conversations?hospital=${encodeURIComponent(hospital)}`);
      if (res.ok) setConversations(await res.json());
    } catch (e) { console.error('Failed to fetch conversations', e); }
  }, [hospital]);

  useEffect(() => {
    fetchConversations();
    const iv = setInterval(fetchConversations, 5000);
    return () => clearInterval(iv);
  }, [fetchConversations]);

  const loadPatientChat = async (patientId: string) => {
    setLoading(true);
    try {
      // Fetch patient context
      const pRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=${patientId}&lang=en`);
      if (pRes.ok) {
        const pData = await pRes.json();
        setActivePatient(pData.patient);

        // Mark messages as read
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/unread`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId, hospital, role: 'desk' })
        });

        await fetchMessages(patientId);
        fetchConversations(); // update badges immediately
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (patientId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat?patientId=${patientId}&hospital=${encodeURIComponent(hospital)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  };

  const scrollToBottom = (force = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (force || !isUserScrolledUpRef.current || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    isUserScrolledUpRef.current = !isNearBottom;
  };

  // Poll for active chat messages
  useEffect(() => {
    if (!activePatient) return;
    const iv = setInterval(() => {
      fetchMessages(activePatient.id);
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/unread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: activePatient.id, hospital, role: 'desk' })
      });
    }, 3000);
    return () => clearInterval(iv);
  }, [activePatient, hospital]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (type: string = 'text', content: string = inputText) => {
    if (!activePatient || !content.trim()) return;

    setSending(true);
    isUserScrolledUpRef.current = false;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: activePatient.id,
          hospital,
          sender: 'desk',
          type,
          content
        }),
      });
      if (res.ok) {
        setInputText('');
        fetchMessages(activePatient.id);
        fetchConversations();
      }
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      await handleSend(type, base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            await handleSend('voice', base64);
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach(t => t.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recording', e);
        alert('Microphone access denied or unavailable.');
      }
    }
  };

  const startNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim()) return;
    const lookupId = newChatInput.includes('@') ? 'P001' : newChatInput.trim();
    await loadPatientChat(lookupId);
    setShowNewChat(false);
    setNewChatInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface-muted)' }}>
      {/* Mock Patient Profile Modal */}
      {showMockProfile && activePatient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 400, background: 'white', padding: '1.5rem', borderRadius: 16, position: 'relative' }}>
            <button onClick={() => setShowMockProfile(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--charcoal)' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={40} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--deep-blue)', marginBottom: '0.2rem' }}>{activePatient.name}</h3>
                <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem', marginTop: '0.2rem' }}>Patient ID: {activePatient.id}</p>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Date of Birth</span>
                <span style={{ color: 'var(--deep-blue)', fontWeight: 600 }}>{activePatient.dob}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Gender</span>
                <span style={{ color: 'var(--deep-blue)', fontWeight: 600 }}>{activePatient.gender}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Blood Type</span>
                <span style={{ color: 'var(--deep-blue)', fontWeight: 600 }}>{activePatient.blood_type || 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Contact</span>
                <span style={{ color: 'var(--deep-blue)', fontWeight: 600 }}>{activePatient.phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 2rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <button onClick={() => router.push('/hospital-desk')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={18} /> Back to Desk
        </button>
        <div style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--deep-blue)' }}>Hospital Desk Chat</div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left Panel: Conversations */}
        <div className="chat-left-panel" style={{ width: 350, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRight: '1px solid var(--border)', zIndex: 5 }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)' }}>Conversations</h3>
            <button onClick={() => setShowNewChat(p => !p)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} />
            </button>
          </div>

          {showNewChat && (
            <div style={{ padding: '1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <form onSubmit={startNewChat} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Patient email or ID..."
                  value={newChatInput}
                  onChange={e => setNewChatInput(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', outline: 'none' }}
                />
                <button type="submit" style={{ padding: '0 0.8rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>Start</button>
              </form>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--charcoal)', fontSize: '0.9rem' }}>No conversations yet.</div>
            ) : (
              conversations.map(c => (
                <div
                  key={c.patientId}
                  onClick={() => loadPatientChat(c.patientId)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '1rem', gap: '1rem', cursor: 'pointer',
                    background: activePatient?.id === c.patientId ? 'var(--primary-light)' : 'var(--surface)',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={24} color="var(--charcoal)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: 'var(--deep-blue)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.patientName}</span>
                      <span style={{ fontSize: '0.75rem', color: c.unreadCount > 0 ? 'var(--accent-green)' : 'var(--foreground-muted)' }}>
                        {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--charcoal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem' }}>
                        {c.lastMessage.length > 30 ? c.lastMessage.slice(0, 30) + '...' : c.lastMessage}
                      </span>
                      {c.unreadCount > 0 && (
                        <span style={{ background: 'var(--accent-green)', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0 0.4rem', borderRadius: 10, minWidth: 20, textAlign: 'center' }}>
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Chat Area */}
        <div className="chat-right-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', position: 'relative' }}>

          {!activePatient ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--charcoal)', background: 'var(--surface-muted)' }}>
              <MessageSquare size={80} style={{ marginBottom: '1.5rem', opacity: 0.1, color: 'var(--primary)' }} />
              <h2 style={{ fontWeight: 300, color: 'var(--foreground-muted)' }}>Web Chat</h2>
              <p style={{ color: 'var(--charcoal)', marginTop: '0.5rem' }}>Select a chat to start messaging.</p>
            </div>
          ) : (
            <>
              {/* Chat Header with condensed Patient Info */}
              <div style={{ padding: '0.75rem 1.5rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className="mobile-back-btn" onClick={() => setActivePatient(null)} style={{ background: 'transparent', border: 'none', padding: '0.5rem', cursor: 'pointer', color: 'var(--charcoal)', alignItems: 'center', justifyContent: 'center', marginLeft: '-1rem', marginRight: '-0.5rem' }}>
                    <ArrowLeft size={20} />
                  </button>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--deep-blue)' }}>{activePatient.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', display: 'flex', gap: '0.5rem' }}>
                      <span>ID: {activePatient.id}</span>
                      <span>· {activePatient.gender}, {activePatient.dob}</span>
                      {activePatient.blood_type && <span>· Blood: {activePatient.blood_type}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowMockProfile(true)} className="glass-button" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>View Profile</button>
                </div>
              </div>

              {/* Messages Area */}
              <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '2rem 5%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading && messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--charcoal)', marginTop: '2rem' }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', background: '#FFF3C4', color: '#856404', padding: '0.5rem 1rem', borderRadius: 8, margin: '1rem auto', fontSize: '0.85rem', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    No messages yet. Send a message to start the conversation.
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.sender === 'desk';
                    return (
                      <div key={m.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                        {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={16} color="var(--charcoal)" /></div>}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 16,
                            borderBottomRightRadius: isMe ? 4 : 16,
                            borderBottomLeftRadius: !isMe ? 4 : 16,
                            background: isMe ? 'var(--primary)' : 'white',
                            color: isMe ? 'white' : 'var(--foreground)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            border: isMe ? 'none' : '1px solid var(--border)',
                            wordBreak: 'break-word'
                          }}>
                            {m.type === 'text' && <div style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{m.content}</div>}
                            {m.type === 'voice' && (
                              <audio controls src={m.content} style={{ height: 36, maxWidth: 220 }} />
                            )}
                            {m.type === 'image' && (
                              <img src={m.content} alt="Attachment" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                            )}
                            {m.type === 'file' && (
                              <a href={m.content} download="attachment" style={{ display: 'flex', alignItems: 'center', gap: 8, color: isMe ? 'white' : 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                                <File size={16} /> Download File
                              </a>
                            )}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                            {m.staffId && <span style={{ fontWeight: 600, marginRight: 4 }}>{m.staffId} •</span>}
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ShieldCheck size={14} color="var(--primary)" /></div>}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--surface-muted)', color: 'var(--charcoal)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                >
                  <Paperclip size={18} />
                </button>

                <input
                  type="text"
                  placeholder={isRecording ? "Recording audio..." : "Type a message..."}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  disabled={isRecording}
                  style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem', outline: 'none' }}
                />

                {inputText.trim() ? (
                  <button
                    onClick={() => handleSend()}
                    disabled={sending}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: 'white', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button
                    onClick={toggleRecording}
                    className={isRecording ? 'pulse-glow' : ''}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: isRecording ? '#FEE2E2' : 'var(--surface-muted)', color: isRecording ? '#DC2626' : 'var(--charcoal)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                  >
                    {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .chat-left-panel { display: ${activePatient ? 'none' : 'flex'} !important; width: 100% !important; border-right: none !important; }
          .chat-right-panel { display: ${!activePatient ? 'none' : 'flex'} !important; width: 100% !important; }
          .mobile-back-btn { display: flex !important; }
        }
        .mobile-back-btn { display: none; }
      `}</style>
    </div>
  );
}
