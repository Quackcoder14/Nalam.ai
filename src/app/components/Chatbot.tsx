'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Phone, AlertTriangle, Loader2, Type, Plus, Minus } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyActions, setEmergencyActions] = useState<string[] | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [approvedPatientId, setApprovedPatientId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle context clear event (when patient context changes)
  useEffect(() => {
    const handleClearContext = () => {
      setConversationId(null);
      setMessages([]);
      setApprovedPatientId(null);
      const greeting = userRole === 'clinician'
        ? 'Context cleared. I\'m ready to help with a new patient context. How can I assist you?'
        : 'Hello! I\'m your medical AI assistant. I can help answer your health questions and provide general medical information. How can I help you today?';
      setMessages([{ role: 'assistant', content: greeting }]);
    };

    const handlePatientContextApproved = (event: CustomEvent) => {
      const { patientId } = event.detail;
      setApprovedPatientId(patientId);
      setConversationId(null); // Start new conversation for new patient
      setMessages([{
        role: 'assistant',
        content: `Patient Context Approved: Patient ID: ${patientId}. I now have access to this patient's information. How can I help you with this patient?`
      }]);
    };

    window.addEventListener('clearChatbotContext', handleClearContext);
    window.addEventListener('patientContextApproved', handlePatientContextApproved as EventListener);

    return () => {
      window.removeEventListener('clearChatbotContext', handleClearContext);
      window.removeEventListener('patientContextApproved', handlePatientContextApproved as EventListener);
    };
  }, [userRole]);

  const loadConversation = useCallback(async () => {
    try {
      const res = await apiFetch('/api/chatbot');
      if (res.ok) {
        const data = await res.json();
        if (data.conversations && data.conversations.length > 0) {
          const latestConversation = data.conversations[0];
          setConversationId(latestConversation.id);
          setMessages(latestConversation.messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })));
        } else {
          // Send greeting message
          const greeting = userRole === 'clinician'
            ? 'Hello! I\'m your medical AI assistant. I can help you with medical knowledge, patient data (when context is approved), and your calendar. How can I assist you today?'
            : 'Hello! I\'m your medical AI assistant. I can help answer your health questions and provide general medical information. How can I help you today?';
          setMessages([{ role: 'assistant', content: greeting }]);
        }
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
      const greeting = userRole === 'clinician'
        ? 'Hello! I\'m your medical AI assistant. I can help you with medical knowledge, patient data (when context is approved), and your calendar. How can I assist you today?'
        : 'Hello! I\'m your medical AI assistant. I can help answer your health questions and provide general medical information. How can I help you today?';
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [userRole]);

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
        content: 'Sorry, I encountered an error. Please try again.' 
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
            zIndex: 9000,
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
                  Medical Assistant
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
                  {userRole === 'clinician' ? 'Clinician Support' : 'Patient Support'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
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
                title="Change Text Size"
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
                title={isExpanded ? 'Collapse' : 'Expand'}
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
                <span>Thinking...</span>
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
                  Emergency Detected
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
                    Call Ambulance
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
                    Alert Family
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
              placeholder="Type your message..."
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
