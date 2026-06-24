'use client';
import { useState, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface TriageResult {
  severity: 'critical' | 'warning' | 'normal';
  riskLevel: string;
  responseMessage: string;
  clinicalSummary: string;
}

export default function VoiceTriage() {
  const { t, lang } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      audioRef.current.pause();
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setIsRecording(true); setResult(null); setTranscript(''); };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsRecording(false);
      setIsProcessing(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/voice-triage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text, lang, patientId: 'P001' })
        });
        if (res.ok) { const data = await res.json(); setResult(data); speakResponse(data.responseMessage); }
      } catch (err) { console.error('Triage failed:', err); }
      finally { setIsProcessing(false); }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsRecording(false); setIsProcessing(false);
    };
    recognition.onend = () => { setIsRecording(false); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => { if (recognitionRef.current) { recognitionRef.current.stop(); } };

  const playAudioFallback = async (text: string, langStr: string) => {
    if (!audioRef.current) return;
    const chunks = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
    for (let chunk of chunks) {
      chunk = chunk.trim();
      if (!chunk) continue;
      if (chunk.length > 200) {
        const subChunks = chunk.match(/.{1,150}(\s|$)/g) || [chunk];
        for (const sub of subChunks) {
          if (!sub.trim()) continue;
          const url = `/api/tts?lang=${langStr === 'ta' ? 'ta' : 'en'}&text=${encodeURIComponent(sub.trim())}`;
          audioRef.current.src = url;
          await new Promise<void>(resolve => {
            if (!audioRef.current) return resolve();
            audioRef.current.onended = () => resolve();
            audioRef.current.onerror = () => resolve();
            audioRef.current.play().catch(() => resolve());
          });
        }
        continue;
      }
      const url = `/api/tts?lang=${langStr === 'ta' ? 'ta' : 'en'}&text=${encodeURIComponent(chunk)}`;
      audioRef.current.src = url;
      await new Promise<void>(resolve => {
        if (!audioRef.current) return resolve();
        audioRef.current.onended = () => resolve();
        audioRef.current.onerror = () => resolve();
        audioRef.current.play().catch(() => resolve());
      });
    }
  };

  const speakResponse = (text: string) => {
    if (!('speechSynthesis' in window)) { playAudioFallback(text, lang); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = 0.9;
    const playNative = () => {
      const voices = window.speechSynthesis.getVoices();
      let hasNativeVoice = false;
      if (lang === 'ta') {
        const tamilVoice = voices.find(v => v.lang.toLowerCase().includes('ta') || v.name.toLowerCase().includes('tamil'));
        if (tamilVoice) { utterance.voice = tamilVoice; hasNativeVoice = true; }
      } else {
        const engVoice = voices.find(v => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-gb'));
        if (engVoice) { utterance.voice = engVoice; hasNativeVoice = true; }
      }
      if (lang === 'ta' && !hasNativeVoice) { playAudioFallback(text, lang); } else { window.speechSynthesis.speak(utterance); }
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      let fired = false;
      window.speechSynthesis.onvoiceschanged = () => {
        if (fired) return; fired = true; playNative(); window.speechSynthesis.onvoiceschanged = null;
      };
      setTimeout(() => { if (!fired) { fired = true; playNative(); } }, 1000);
    } else { playNative(); }
  };

  const getRiskColor = (severity: string) => {
    if (severity === 'critical') return 'var(--accent-red)';
    if (severity === 'warning') return 'var(--accent-amber)';
    return 'var(--accent-green)';
  };
  const getRiskBg = (severity: string) => {
    if (severity === 'critical') return 'var(--accent-red-bg)';
    if (severity === 'warning') return 'var(--accent-amber-bg)';
    return 'var(--accent-green-bg)';
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '1rem' }}>
      <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--deep-blue)', fontSize: '0.92rem' }}>
          <Mic size={16} color="var(--primary)" /> {t('dashboard.voiceTriage')}
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', padding: '0.5rem 0' }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(0,82,165,0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              opacity: isProcessing ? 0.7 : 1
            }}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.94)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.06)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isProcessing ? <Loader2 size={28} className="spin" /> : <Mic size={28} />}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--accent-red)', color: 'white',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulseGlowRed 1.5s infinite'
            }}
          >
            <MicOff size={28} />
          </button>
        )}

        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isRecording ? 'var(--accent-red)' : 'var(--charcoal)', textAlign: 'center' }}>
          {isRecording ? t('dashboard.listening') : isProcessing ? t('dashboard.processingVoice') : t('dashboard.tapToSpeak')}
        </div>

        {transcript && !result && !isRecording && (
          <div style={{ padding: '0.65rem 0.85rem', background: 'var(--surface-muted)', borderRadius: 8, fontSize: '0.84rem', fontStyle: 'italic', width: '100%', textAlign: 'center', lineHeight: 1.4 }}>
            "{transcript}"
          </div>
        )}

        {result && (
          <div style={{
            width: '100%',
            padding: '1rem',
            borderRadius: 12,
            background: getRiskBg(result.severity),
            border: `1.5px solid ${getRiskColor(result.severity)}`,
            animation: 'fadeIn 0.4s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem', color: getRiskColor(result.severity), fontWeight: 700, fontSize: '0.9rem' }}>
              {result.severity === 'critical' ? <AlertTriangle size={18} /> : result.severity === 'warning' ? <Info size={18} /> : <CheckCircle size={18} />}
              {t('dashboard.voiceRiskLevel')}: {result.riskLevel}
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.55, marginBottom: '0.45rem' }}>
              <strong>AI:</strong> {result.responseMessage}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--charcoal)', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.4rem', marginTop: '0.4rem', lineHeight: 1.4 }}>
              "{transcript}"
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlowRed {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
