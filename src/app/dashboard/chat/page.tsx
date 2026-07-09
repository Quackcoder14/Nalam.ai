'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Send, Mic, Paperclip, Building2, User, UserCircle, StopCircle, Image as ImageIcon, File, X } from 'lucide-react';

const HOSPITALS = ['Apollo Hospital', 'Kauvery Hospital', 'Govt Hospital'];

export default function PatientChat() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading chat...</div>}>
      <PatientChatInner />
    </Suspense>
  );
}

function PatientChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const getPatientId = () =>
    sessionStorage.getItem('nalamPatientId') || localStorage.getItem('nalamPatientId') || 'P001';
  const [selectedHospital, setSelectedHospital] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mockProfile, setMockProfile] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUserScrolledUpRef = useRef(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchMessages = async (hospital: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat?patientId=${getPatientId()}&hospital=${encodeURIComponent(hospital)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => {
          // Only update if messages actually changed to avoid unnecessary re-renders
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
        // Mark as read
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/unread`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: getPatientId(), hospital, role: 'patient' })
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

  useEffect(() => {
    const h = searchParams.get('hospital');
    const p = searchParams.get('prefill');
    if (h) setSelectedHospital(h);
    if (p) setInputText(p);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedHospital) return;
    setLoading(true);
    isUserScrolledUpRef.current = false;
    fetchMessages(selectedHospital).finally(() => setLoading(false));

    const iv = setInterval(() => fetchMessages(selectedHospital), 3000);
    return () => clearInterval(iv);
  }, [selectedHospital]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (type: string = 'text', content: string = inputText) => {
    if (!selectedHospital || !content.trim()) return;

    setSending(true);
    isUserScrolledUpRef.current = false; // always scroll after sending
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: getPatientId(),
          hospital: selectedHospital,
          sender: 'patient',
          type,
          content
        }),
      });
      if (res.ok) {
        setInputText('');
        fetchMessages(selectedHospital);
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

  return (
    <div className="container fade-in chat-container" style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', height: '90vh', gap: '1rem', padding: '1rem' }}>
      <style>{`
        .chat-sidebar { display: flex; }
        .chat-main { display: flex; }
        @media (max-width: 768px) {
          .chat-container { height: 100vh; height: 100dvh; max-width: 100%; margin: 0; border-radius: 0; gap: 0; padding: 0 !important; }
          .chat-header-global { display: none !important; }
          .chat-sidebar { display: ${selectedHospital ? 'none' : 'flex'}; width: 100% !important; border-radius: 0; border: none; }
          .chat-main { display: ${selectedHospital ? 'flex' : 'none'}; position: fixed; inset: 0; z-index: 50; border-radius: 0; }
        }
      `}</style>
      {/* Header */}
      {/* Mock Profile Modal */}
      {mockProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', padding: '1.5rem', borderRadius: 16, position: 'relative' }}>
            <button onClick={() => setMockProfile(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--charcoal)' }}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCircle size={48} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--deep-blue)', marginBottom: '0.2rem' }}>Staff Profile</h3>
                <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>Hospital Desk</p>
                <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Hospital Desk Representative at {selectedHospital}</p>
                <div style={{ marginTop: '0.5rem', background: 'var(--surface-muted)', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', color: 'var(--charcoal)', display: 'inline-block' }}>
                  Staff ID: {mockProfile}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--charcoal)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)' }} /> Currently Active
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--charcoal)', fontSize: '0.85rem' }}>
                <Building2 size={14} /> Assigned to Front Desk Support
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="chat-header-global" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 0 }}>💬 Chat with Hospital Desk</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem' }}>Secure, direct communication with your healthcare provider.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '1.5rem', overflow: 'hidden' }}>
        {/* Sidebar - Hospitals */}
        <div className="glass-panel chat-sidebar" style={{ width: 320, flexDirection: 'column', padding: '1rem', overflowY: 'auto' }}>
          {/* Mobile Back Button for Sidebar */}
          <div className="mobile-only-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <style>{`@media (min-width: 769px) { .mobile-only-header { display: none !important; } }`}</style>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
              <ArrowLeft size={18} /> Dashboard
            </button>
          </div>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--charcoal)', marginBottom: '1rem', fontWeight: 700 }}>AVAILABLE HOSPITALS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {HOSPITALS.map(h => (
              <button
                key={h}
                onClick={() => setSelectedHospital(h)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 8,
                  border: `1.5px solid ${selectedHospital === h ? 'var(--primary)' : 'var(--border)'}`,
                  background: selectedHospital === h ? 'var(--primary-light)' : 'var(--surface)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: selectedHospital === h ? 'var(--primary)' : 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedHospital === h ? 'white' : 'var(--charcoal)' }}>
                  <Building2 size={18} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: selectedHospital === h ? 'var(--deep-blue)' : 'var(--foreground)' }}>
                  {h}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="glass-panel chat-main" style={{ flex: 1, flexDirection: 'column', overflow: 'hidden', padding: 0, position: 'relative' }}>
          {!selectedHospital && (
            <div className="desktop-placeholder" style={{ position: 'absolute', inset: 0, background: 'rgba(128,128,128,0.3)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--charcoal)' }}>
              <style>{`@media (max-width: 768px) { .desktop-placeholder { display: none !important; } }`}</style>
              <Building2 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3>Select a hospital to start chatting</h3>
            </div>
          )}

          {/* Chat Header */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="mobile-chat-back" onClick={() => setSelectedHospital('')} style={{ background: 'transparent', border: 'none', padding: '0.5rem', cursor: 'pointer', color: 'var(--deep-blue)' }}>
              <style>{`@media (min-width: 769px) { .mobile-chat-back { display: none !important; } }`}</style>
              <ArrowLeft size={20} />
            </button>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--deep-blue)' }}>{selectedHospital || 'Hospital Desk'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--surface-muted)' }}>
            {loading && messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--charcoal)', marginTop: '2rem' }}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--charcoal)', marginTop: '2rem' }}>No messages yet. Say hello!</div>
            ) : (
              messages.map(m => {
                const isMe = m.sender === 'patient';
                return (
                  <div key={m.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={16} color="var(--charcoal)" /></div>}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 16,
                        borderBottomRightRadius: isMe ? 4 : 16,
                        borderBottomLeftRadius: !isMe ? 4 : 16,
                        background: isMe ? 'var(--primary)' : 'var(--surface)',
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
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {!isMe && m.staffId && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}>
                            · {m.staffId}
                          </span>
                        )}
                        {!isMe && m.staffId && (
                          <button onClick={() => setMockProfile(m.staffId)} style={{ marginLeft: '0.5rem', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.65rem', textDecoration: 'underline' }}>
                            View Profile
                          </button>
                        )}
                      </span>
                    </div>

                    {isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={14} color="var(--primary)" /></div>}
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

            <button 
              onClick={toggleRecording}
              className={isRecording ? 'pulse-glow' : ''}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: isRecording ? '#FEE2E2' : 'var(--surface-muted)', color: isRecording ? '#DC2626' : 'var(--charcoal)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
            >
              {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
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

            <button 
              onClick={() => handleSend()}
              disabled={sending || (!inputText.trim() && !isRecording)}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: 'white', cursor: sending || (!inputText.trim() && !isRecording) ? 'not-allowed' : 'pointer', opacity: sending || (!inputText.trim() && !isRecording) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
