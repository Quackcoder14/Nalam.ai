'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Mic, Paperclip, Building2, User, UserCircle, StopCircle, Image as ImageIcon, File } from 'lucide-react';

const HOSPITALS = ['Apollo Hospitals', 'Fortis Healthcare', 'Nalam.ai General Hospital'];

export default function PatientChat() {
  const router = useRouter();
  const [selectedHospital, setSelectedHospital] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchMessages = async (hospital: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat?patientId=P001&hospital=${encodeURIComponent(hospital)}`);
      if (res.ok) {
        setMessages(await res.json());
        // Mark as read
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/unread`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: 'P001', hospital, role: 'patient' })
        });
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  };

  useEffect(() => {
    if (!selectedHospital) return;
    setLoading(true);
    fetchMessages(selectedHospital).finally(() => setLoading(false));

    const iv = setInterval(() => fetchMessages(selectedHospital), 3000);
    return () => clearInterval(iv);
  }, [selectedHospital]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (type: string = 'text', content: string = inputText) => {
    if (!selectedHospital || !content.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 'P001',
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
    <div className="container fade-in" style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', height: '90vh', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
        <div className="glass-panel" style={{ width: 280, display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto' }}>
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
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, position: 'relative' }}>
          {!selectedHospital && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--charcoal)' }}>
              <Building2 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3>Select a hospital to start chatting</h3>
            </div>
          )}

          {/* Chat Header */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#F8FAFC' }}>
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
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
