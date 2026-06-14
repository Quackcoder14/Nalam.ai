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
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }

    // Stop any ongoing TTS and "unlock" the audio element for autoplay
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      // Start and immediately pause to unlock it during user interaction
      audioRef.current.play().catch(() => {});
      audioRef.current.pause();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setResult(null);
      setTranscript('');
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsRecording(false);
      setIsProcessing(true);
      
      try {
        const res = await fetch('/api/agents/voice-triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text, lang, patientId: 'P001' })
        });
        
        if (res.ok) {
          const data = await res.json();
          setResult(data);
          speakResponse(data.responseMessage);
        }
      } catch (err) {
        console.error('Triage failed:', err);
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsRecording(false);
      setIsProcessing(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const playAudioFallback = async (text: string, langStr: string) => {
    if (!audioRef.current) return;
    
    // Split into chunks to respect URL limits
    const chunks = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
    
    for (let chunk of chunks) {
      chunk = chunk.trim();
      if (!chunk) continue;
      
      // If chunk is too long, split by space
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
    if (!('speechSynthesis' in window)) {
      playAudioFallback(text, lang);
      return;
    }
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = 0.9;
    
    const playNative = () => {
      const voices = window.speechSynthesis.getVoices();
      let hasNativeVoice = false;
      
      if (lang === 'ta') {
        const tamilVoice = voices.find(v => v.lang.toLowerCase().includes('ta') || v.name.toLowerCase().includes('tamil'));
        if (tamilVoice) {
          utterance.voice = tamilVoice;
          hasNativeVoice = true;
        }
      } else {
        const engVoice = voices.find(v => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-gb'));
        if (engVoice) {
          utterance.voice = engVoice;
          hasNativeVoice = true;
        }
      }
      
      // If no native voice exists for the target language (especially Tamil), use cloud fallback!
      if (lang === 'ta' && !hasNativeVoice) {
        playAudioFallback(text, lang);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      let fired = false;
      window.speechSynthesis.onvoiceschanged = () => {
        if (fired) return;
        fired = true;
        playNative();
        window.speechSynthesis.onvoiceschanged = null;
      };
      // Timeout fallback if onvoiceschanged never fires
      setTimeout(() => {
        if (!fired) {
          fired = true;
          playNative();
        }
      }, 1000);
    } else {
      playNative();
    }
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
    <div className="glass-panel" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)' }}>
          <Mic size={19} color="var(--primary)" /> {t('dashboard.voiceTriage')}
        </h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
        {!isRecording ? (
          <button 
            onClick={startRecording}
            disabled={isProcessing}
            style={{ 
              width: 80, height: 80, borderRadius: '50%', 
              background: 'var(--primary)', color: 'white',
              border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              opacity: isProcessing ? 0.7 : 1
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isProcessing ? <Loader2 size={32} className="spin" /> : <Mic size={32} />}
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            style={{ 
              width: 80, height: 80, borderRadius: '50%', 
              background: 'var(--accent-red)', color: 'white',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
              animation: 'pulseGlowRed 1.5s infinite'
            }}
          >
            <MicOff size={32} />
          </button>
        )}
        
        <div style={{ fontWeight: 600, color: isRecording ? 'var(--accent-red)' : 'var(--charcoal)' }}>
          {isRecording ? t('dashboard.listening') : isProcessing ? t('dashboard.processingVoice') : t('dashboard.tapToSpeak')}
        </div>

        {transcript && !result && !isRecording && (
          <div style={{ padding: '0.8rem', background: 'var(--surface-muted)', borderRadius: 8, fontSize: '0.9rem', fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
            "{transcript}"
          </div>
        )}

        {result && (
          <div style={{ 
            width: '100%', 
            padding: '1.2rem', 
            borderRadius: 12, 
            background: getRiskBg(result.severity),
            border: `1.5px solid ${getRiskColor(result.severity)}`,
            animation: 'fadeIn 0.4s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: getRiskColor(result.severity), fontWeight: 700 }}>
              {result.severity === 'critical' ? <AlertTriangle size={20} /> : result.severity === 'warning' ? <Info size={20} /> : <CheckCircle size={20} />}
              {t('dashboard.voiceRiskLevel')}: {result.riskLevel}
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
              <strong>AI:</strong> {result.responseMessage}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              "{transcript}"
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlowRed {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
