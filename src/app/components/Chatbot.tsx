'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Phone, AlertTriangle, Loader2, Type, Plus, Minus, Mic, MicOff } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useLanguage } from '@/lib/i18n';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatbotProps = {
  userRole: 'patient' | 'clinician';
  patientData?: Record<string, unknown>;
  doctorCalendar?: Record<string, unknown>;
};

export default function Chatbot({ userRole }: ChatbotProps) {
  const { t, lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [generalConversationId, setGeneralConversationId] = useState<string | null>(null); // For clinician's general chat
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyActions, setEmergencyActions] = useState<string[] | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [approvedPatientId, setApprovedPatientId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadConversation = useCallback(async (loadGeneral = false) => {
    try {
      const res = await apiFetch('/api/chatbot');
      if (res.ok) {
        const data = await res.json();
        if (data.conversations && data.conversations.length > 0) {
          // For clinicians, if loading general, find the conversation without patient context
          // Otherwise, use the latest conversation
          let targetConversation;
          if (userRole === 'clinician' && loadGeneral) {
            // Try to find a conversation that doesn't have patient context
            targetConversation = data.conversations.find((conv: any) => 
              !conv.messages.some((m: any) => m.content.includes('Patient Context Approved:'))
            ) || data.conversations[0];
          } else {
            targetConversation = data.conversations[0];
          }
          
          setConversationId(targetConversation.id);
          setMessages(targetConversation.messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })));
        } else {
          // Send greeting message
          const greeting = userRole === 'clinician'
            ? t('chatbot.greetingClinician')
            : t('chatbot.greetingPatient');
          setMessages([{ role: 'assistant', content: greeting }]);
        }
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
      const greeting = userRole === 'clinician'
        ? t('chatbot.greetingClinician')
        : t('chatbot.greetingPatient');
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [userRole, t]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle context clear event (when patient context changes)
  useEffect(() => {
    const handleClearContext = () => {
      // For clinicians: switch back to general conversation
      if (userRole === 'clinician') {
        setApprovedPatientId(null);
        setMessages([]);
        // Reload general conversation
        loadConversation(true).then(() => {
          setConversationId(generalConversationId);
        });
      } else {
        setConversationId(null);
        setMessages([]);
        setApprovedPatientId(null);
        const greeting = t('chatbot.greetingPatient');
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    };

    const handlePatientContextApproved = (event: CustomEvent) => {
      const { patientId } = event.detail;
      setApprovedPatientId(patientId);
      
      // For clinicians: save current conversation as general, then start new patient-specific conversation
      if (userRole === 'clinician') {
        // Save current conversation as general if not already saved
        if (!generalConversationId && conversationId) {
          setGeneralConversationId(conversationId);
        }
        
        // Start new conversation for this patient
        setConversationId(null);
        setMessages([{
          role: 'assistant',
          content: t('chatbot.patientContextApproved').replace('{patientId}', patientId)
        }]);
      } else {
        setConversationId(null); // Start new conversation for new patient
        setMessages([{
          role: 'assistant',
          content: t('chatbot.patientContextApproved').replace('{patientId}', patientId)
        }]);
      }
    };

    window.addEventListener('clearChatbotContext', handleClearContext);
    window.addEventListener('patientContextApproved', handlePatientContextApproved as EventListener);

    return () => {
      window.removeEventListener('clearChatbotContext', handleClearContext);
      window.removeEventListener('patientContextApproved', handlePatientContextApproved as EventListener);
    };
  }, [userRole, conversationId, generalConversationId, loadConversation, t]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadConversation();
    }
  }, [isOpen, messages.length, loadConversation]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await apiFetch('/api/chatbot', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          lang,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setConversationId(data.conversationId);
        setIsEmergency(data.is_emergency || false);
        setEmergencyActions(data.emergency_actions || null);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: t('chatbot.error')
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCallAmbulance = () => {
    window.location.href = 'tel:108'; // India emergency number
  };

  const handleAlertFamily = () => {
    // This would integrate with WhatsApp
    const message = encodeURIComponent('EMERGENCY: I need immediate help. Please contact me urgently.');
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  // Voice recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
        
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsRecording(false);
        };
        
        rec.onerror = () => {
          setIsRecording(false);
        };
        
        rec.onend = () => {
          setIsRecording(false);
        };
        
        setRecognition(rec);
      }
    }
  }, [lang]);

  const startRecording = () => {
    if (recognition && !isRecording) {
      setIsRecording(true);
      recognition.start();
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatbot-button-mobile"
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1.5rem)',
            right: '1.5rem',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--primary)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,82,165,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            transition: 'all 0.3s',
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={28} color="white" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="chatbot-window-mobile"
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1.5rem)',
            right: '1.5rem',
            width: isExpanded ? '600px' : '400px',
            maxWidth: isExpanded ? 'calc(100vw - 48px)' : 'calc(100vw - 48px)',
            height: isExpanded ? '700px' : '550px',
            maxHeight: isExpanded ? 'calc(100vh - 48px)' : 'calc(100vh - 48px)',
            background: 'var(--surface)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9000,
            border: '1px solid var(--border)',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--primary)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageCircle size={20} color="white" />
              </div>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                  {t('chatbot.title')}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
                  {userRole === 'clinician' ? t('chatbot.clinicianSupport') : t('chatbot.patientSupport')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {userRole === 'clinician' && (
                <button
                  onClick={async () => {
                    setMessages([]);
                    if (approvedPatientId) {
                      // Reload with patient context
                      setMessages([{
                        role: 'assistant',
                        content: t('chatbot.patientContextApproved').replace('{patientId}', approvedPatientId)
                      }]);
                    } else {
                      // Reload general conversation
                      await loadConversation(true);
                    }
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={t('chatbot.refresh')}
                >
                  <Loader2 size={18} color="white" />
                </button>
              )}
              <button
                onClick={() => {
                  const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
                  const currentIndex = sizes.indexOf(textSize);
                  const nextIndex = (currentIndex + 1) % sizes.length;
                  setTextSize(sizes[nextIndex]);
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={t('chatbot.changeTextSize')}
              >
                <Type size={18} color="white" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={isExpanded ? t('chatbot.collapse') : t('chatbot.expand')}
              >
                {isExpanded ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M4 8V4h4M4 16v4h4M16 4h4v4M16 20h4v-4"/>
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} color="white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user'
                    ? 'var(--primary)'
                    : 'var(--surface-muted)',
                  color: msg.role === 'user' ? 'white' : 'var(--foreground)',
                  wordBreak: 'break-word',
                  fontSize: textSize === 'small' ? '0.85rem' : textSize === 'medium' ? '0.95rem' : '1.1rem',
                  lineHeight: textSize === 'small' ? '1.4' : textSize === 'medium' ? '1.5' : '1.6',
                  whiteSpace: 'pre-line',
                }}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  alignSelf: 'flex-start',
                  background: 'var(--surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: textSize === 'small' ? '0.85rem' : textSize === 'medium' ? '0.9rem' : '1rem',
                }}
              >
                <Loader2 size={16} className="spin" />
                <span>{t('chatbot.thinking')}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Emergency Actions */}
          {isEmergency && emergencyActions && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.1)',
                borderTop: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>
                  {t('chatbot.emergencyDetected')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {emergencyActions.includes('call_ambulance') && (
                  <button
                    onClick={handleCallAmbulance}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #ef4444',
                      background: '#ef4444',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    <Phone size={16} />
                    {t('chatbot.callAmbulance')}
                  </button>
                )}
                {emergencyActions.includes('alert_family') && (
                  <button
                    onClick={handleAlertFamily}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #25D366',
                      background: '#25D366',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    <MessageCircle size={16} />
                    {t('chatbot.alertFamily')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('chatbot.typeMessage')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '24px',
                border: '1px solid var(--border)',
                background: 'var(--surface-muted)',
                color: 'var(--foreground)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            {recognition && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: isRecording ? '#ef4444' : 'var(--surface-muted)',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                title={isRecording ? t('chatbot.stopRecording') : t('chatbot.voiceInput')}
              >
                {isRecording ? <MicOff size={20} color="white" /> : <Mic size={20} color="var(--foreground-muted)" />}
              </button>
            )}
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: input.trim() ? 'var(--primary)' : 'var(--surface-muted)',
                border: 'none',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <Send size={20} color={input.trim() ? 'white' : 'var(--foreground-muted)'} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .chatbot-button-mobile {
            bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1.5rem) !important;
            right: 0.75rem !important;
          }
          .chatbot-window-mobile {
            bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1.5rem) !important;
            right: 0.75rem !important;
            width: calc(100vw - 1.5rem) !important;
            max-width: calc(100vw - 1.5rem) !important;
            height: calc(100vh - var(--bottom-nav-height) - env(safe-area-inset-bottom) - 3rem) !important;
            max-height: calc(100vh - var(--bottom-nav-height) - env(safe-area-inset-bottom) - 3rem) !important;
          }
        }
      `}</style>
    </>
  );
}
