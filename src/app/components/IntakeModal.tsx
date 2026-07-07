'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, ChevronRight, ChevronLeft, Send, CheckCircle, X, Loader2, Volume2, Keyboard } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

// ── Standard clinical intake questions ─────────────────────────────────────────
const INTAKE_QUESTIONS = [
  {
    id: 'duration',
    question: 'How long have you been experiencing this?',
    questionTa: 'இந்த பிரச்சினை எவ்வளவு நாளாக உள்ளது?',
    type: 'choice',
    options: ['Today', 'A few days', '1–2 weeks', 'More than a month', 'Ongoing'],
    optionsTa: ['இன்று', 'சில நாட்கள்', '1–2 வாரங்கள்', 'ஒரு மாதத்திற்கு மேல்', 'நீண்ட நாளாக'],
  },
  {
    id: 'severity',
    question: 'How severe is the discomfort on a scale of 1 to 10?',
    questionTa: '1 முதல் 10 வரை அசௌகரியத்தின் தீவிரம் என்ன?',
    type: 'choice',
    options: ['1–3 (Mild)', '4–6 (Moderate)', '7–8 (Severe)', '9–10 (Unbearable)'],
    optionsTa: ['1–3 (லேசானது)', '4–6 (மிதமானது)', '7–8 (கடுமையானது)', '9–10 (தாங்க முடியாதது)'],
  },
  {
    id: 'fever',
    question: 'Do you currently have fever or chills?',
    questionTa: 'தற்போது காய்ச்சல் அல்லது குளிர் உள்ளதா?',
    type: 'choice',
    options: ['Yes, high fever', 'Yes, mild fever', 'No fever', 'Chills only'],
    optionsTa: ['ஆம், அதிக காய்ச்சல்', 'ஆம், லேசான காய்ச்சல்', 'காய்ச்சல் இல்லை', 'குளிர் மட்டும்'],
  },
  {
    id: 'allergies_known',
    question: 'Are you allergic to any medications?',
    questionTa: 'ஏதாவது மருந்துகளுக்கு ஒவ்வாமை உள்ளதா?',
    type: 'choice',
    options: ['No known allergies', 'Yes — Penicillin', 'Yes — NSAIDs', 'Yes — Sulfa drugs', 'Other'],
    optionsTa: ['ஒவ்வாமை இல்லை', 'ஆம் — பெனிசிலின்', 'ஆம் — NSAIDs', 'ஆம் — சல்ஃபா மருந்துகள்', 'பிற'],
  },
  {
    id: 'current_meds',
    question: 'Are you currently taking any medications?',
    questionTa: 'தற்போது ஏதாவது மருந்து சாப்பிடுகிறீர்களா?',
    type: 'choice',
    options: ['No', 'Yes (for Blood Pressure)', 'Yes (for Diabetes)', 'Yes (for Heart)', 'Other / Multiple'],
    optionsTa: ['இல்லை', 'ஆம் (இரத்த அழுத்தம்)', 'ஆம் (நீரிழிவு)', 'ஆம் (இதயம்)', 'பிற / பல மருந்துகள்'],
  },
  {
    id: 'additional',
    question: 'Is there anything else you want the doctor to know?',
    questionTa: 'மருத்துவருக்கு தெரிவிக்க வேண்டிய வேறு ஏதாவது இருக்கிறதா?',
    type: 'text',
  },
];

interface IntakeModalProps {
  intakeId: string;
  patientId: string;
  lang?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function IntakeModal({ intakeId, patientId, lang = 'en', onClose, onSubmitted }: IntakeModalProps) {
  const isTa = lang === 'ta';

  // Step 0 = symptoms entry, Step 1..N = questions, Step N+1 = review
  const TOTAL_STEPS = INTAKE_QUESTIONS.length + 2; // 0: symptoms, 1–N: questions, last: review
  const REVIEW_STEP = INTAKE_QUESTIONS.length + 1;

  const [step, setStep] = useState(0);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('text');
  const [symptoms, setSymptoms] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const currentQ = step > 0 && step <= INTAKE_QUESTIONS.length ? INTAKE_QUESTIONS[step - 1] : null;

  // ── Voice recording helpers ─────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();
          const text = data.text || '';
          if (step === 0) setSymptoms(prev => prev ? prev + ' ' + text : text);
          else if (currentQ) setAnswers(prev => ({ ...prev, [currentQ.id]: text }));
        } catch {}
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      alert('Microphone access denied.');
    }
  }, [step, currentQ]);

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
  }, []);

  // ── Submit final ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    const fullQuestionnaire: Record<string, string> = {};
    INTAKE_QUESTIONS.forEach(q => {
      const ans = answers[q.id];
      if (ans === 'Other' || ans === 'பிற') {
        fullQuestionnaire[q.question] = otherText[q.id] || 'Other';
      } else {
        fullQuestionnaire[q.question] = ans || 'Not answered';
      }
    });
    try {
      const res = await apiFetch(`/api/intake/${intakeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'submit', symptoms, questionnaire: fullQuestionnaire, lang }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
      setTimeout(() => { onSubmitted(); onClose(); }, 2000);
    } catch (e) {
      alert('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return symptoms.trim().length > 0;
    if (currentQ) {
      const ans = answers[currentQ.id];
      if (!ans) return false;
      if ((ans === 'Other' || ans === 'பிற') && !otherText[currentQ.id]?.trim()) return false;
      return true;
    }
    return true;
  };

  const progressPct = Math.round((step / (TOTAL_STEPS - 1)) * 100);

  if (submitted) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle size={64} color="var(--accent-green)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ color: 'var(--foreground)', marginBottom: '0.5rem' }}>
              {isTa ? 'சமர்ப்பிக்கப்பட்டது!' : 'Submitted!'}
            </h2>
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>
              {isTa ? 'உங்கள் தகவல் மருத்துவமனை மேசைக்கு அனுப்பப்பட்டது.' : 'Your information has been sent to the hospital desk.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--foreground)', fontWeight: 700 }}>
              {isTa ? '🏥 அறிகுறி பதிவு' : '🏥 Symptom Intake'}
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>
              {step === 0
                ? (isTa ? 'படி 1: உங்கள் அறிகுறிகளை பதிவு செய்யுங்கள்' : 'Step 1: Describe your symptoms')
                : step <= INTAKE_QUESTIONS.length
                ? (isTa ? `கேள்வி ${step} / ${INTAKE_QUESTIONS.length}` : `Question ${step} of ${INTAKE_QUESTIONS.length}`)
                : (isTa ? 'மதிப்பாய்வு & சமர்ப்பி' : 'Review & Submit')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--surface-muted)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--primary)', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* ── STEP 0: Symptoms Entry ─── */}
        {step === 0 && (
          <div>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '1rem', fontWeight: 600 }}>
              {isTa ? 'இன்று உங்களுக்கு என்ன பிரச்சினை?' : 'What brings you in today?'}
            </p>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => setInputMode('text')} style={modeBtn(inputMode === 'text')}>
                <Keyboard size={14} /> {isTa ? 'தட்டச்சு' : 'Type'}
              </button>
              <button onClick={() => setInputMode('voice')} style={modeBtn(inputMode === 'voice')}>
                <Volume2 size={14} /> {isTa ? 'குரல்' : 'Voice'}
              </button>
            </div>
            {inputMode === 'text' ? (
              <textarea
                rows={5}
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder={isTa ? 'உங்கள் அறிகுறிகளை விவரிக்கவும்...' : 'Describe your symptoms in detail...'}
                style={textareaStyle}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  style={{
                    width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: recording ? 'var(--accent-red)' : 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem',
                    boxShadow: recording ? '0 0 0 8px rgba(239,68,68,0.2)' : '0 4px 20px rgba(0,82,165,0.3)',
                    animation: recording ? 'pulseGlow 1.5s infinite' : 'none',
                  }}
                >
                  {recording ? <MicOff size={28} color="white" /> : <Mic size={28} color="white" />}
                </button>
                <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                  {recording ? (isTa ? 'பேசுங்கள்... நிறுத்த தட்டவும்' : 'Speaking... Tap to stop') : (isTa ? 'பதிவு தொடங்க தட்டவும்' : 'Tap to record')}
                </p>
                {symptoms && (
                  <div style={{ marginTop: '1rem', background: 'var(--surface-muted)', borderRadius: 8, padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--foreground)' }}>
                    <strong>{isTa ? 'பதிவு செய்யப்பட்டது:' : 'Captured:'}</strong> {symptoms}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEPS 1–N: Questions ─── */}
        {currentQ && (
          <div>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '1.25rem', fontWeight: 600, lineHeight: 1.5 }}>
              {isTa ? currentQ.questionTa : currentQ.question}
            </p>

            {currentQ.type === 'choice' && currentQ.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(isTa ? currentQ.optionsTa! : currentQ.options).map((opt, i) => {
                  const val = currentQ.options![i];
                  const isSelected = answers[currentQ.id] === val;
                  const isOther = val === 'Other';
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setAnswers(p => ({ ...p, [currentQ.id]: val }))}
                        style={choiceBtn(isSelected)}
                      >
                        <span style={{ flex: 1, textAlign: 'left' }}>{opt}</span>
                        {isSelected && <CheckCircle size={16} />}
                      </button>
                      {isSelected && isOther && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <input
                            value={otherText[currentQ.id] || ''}
                            onChange={e => setOtherText(p => ({ ...p, [currentQ.id]: e.target.value }))}
                            placeholder={isTa ? 'குறிப்பிடவும்...' : 'Please specify...'}
                            style={{ flex: 1, ...inputStyle }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentQ.type === 'text' && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button onClick={() => setInputMode('text')} style={modeBtn(inputMode === 'text')}><Keyboard size={14} />{isTa ? 'தட்டச்சு' : 'Type'}</button>
                  <button onClick={() => setInputMode('voice')} style={modeBtn(inputMode === 'voice')}><Volume2 size={14} />{isTa ? 'குரல்' : 'Voice'}</button>
                </div>
                {inputMode === 'text' ? (
                  <textarea
                    rows={3}
                    value={answers[currentQ.id] || ''}
                    onChange={e => setAnswers(p => ({ ...p, [currentQ.id]: e.target.value }))}
                    placeholder={isTa ? 'இங்கே தட்டச்சு செய்யவும்...' : 'Type here...'}
                    style={textareaStyle}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      style={{
                        width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: recording ? 'var(--accent-red)' : 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem',
                        animation: recording ? 'pulseGlow 1.5s infinite' : 'none',
                      }}
                    >
                      {recording ? <MicOff size={22} color="white" /> : <Mic size={22} color="white" />}
                    </button>
                    <p style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>
                      {recording ? (isTa ? 'பேசுங்கள்...' : 'Speaking...') : (isTa ? 'தட்டி பதிவு செய்யவும்' : 'Tap to record')}
                    </p>
                    {answers[currentQ.id] && (
                      <div style={{ marginTop: '0.75rem', background: 'var(--surface-muted)', borderRadius: 8, padding: '0.6rem', textAlign: 'left', fontSize: '0.82rem' }}>
                        {answers[currentQ.id]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW STEP ─── */}
        {step === REVIEW_STEP && (
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '1rem' }}>
              {isTa ? 'உங்கள் பதில்களை மதிப்பாய்வு செய்யவும்:' : 'Review your responses:'}
            </h3>

            <div style={{ background: 'var(--surface-muted)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--foreground-subtle)', marginBottom: '0.3rem' }}>
                {isTa ? 'அறிகுறிகள்' : 'Symptoms'}
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--foreground)', margin: 0 }}>{symptoms}</p>
            </div>

            {INTAKE_QUESTIONS.map(q => {
              const ans = answers[q.id];
              const displayAns = (ans === 'Other' || ans === 'பிற') ? (otherText[q.id] || 'Other') : (ans || '—');
              return (
                <div key={q.id} style={{ background: 'var(--surface-muted)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--foreground-subtle)', marginBottom: '0.2rem' }}>
                    {isTa ? q.questionTa : q.question}
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--foreground)', margin: 0, fontWeight: 600 }}>{displayAns}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Navigation ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '0.75rem' }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={secondaryBtn}>
              <ChevronLeft size={16} /> {isTa ? 'முந்தைய' : 'Back'}
            </button>
          ) : <div />}

          {step < REVIEW_STEP ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} style={primaryBtn(!canProceed())}>
              {step === 0 ? (isTa ? 'கேள்விகள்' : 'Nurse Questions') : (isTa ? 'அடுத்து' : 'Next')}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={primaryBtn(submitting)}>
              {submitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              {submitting ? (isTa ? 'சமர்ப்பிக்கிறது...' : 'Submitting...') : (isTa ? 'சமர்ப்பி' : 'Submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10000, padding: '1rem',
};
const modalStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 18, padding: '1.5rem',
  width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
  animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '0.85rem', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--surface-muted)',
  color: 'var(--foreground)', fontFamily: 'inherit', fontSize: '0.9rem',
  resize: 'vertical', boxSizing: 'border-box',
};
const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.85rem', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--surface-muted)',
  color: 'var(--foreground)', fontFamily: 'inherit', fontSize: '0.85rem', width: '100%',
};
const choiceBtn = (selected: boolean): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.7rem 1rem', borderRadius: 10, cursor: 'pointer',
  border: selected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
  background: selected ? 'rgba(var(--primary-rgb),0.08)' : 'var(--surface-muted)',
  color: selected ? 'var(--primary)' : 'var(--foreground)',
  fontWeight: selected ? 700 : 500, fontSize: '0.88rem',
  transition: 'all 0.15s', textAlign: 'left',
});
const modeBtn = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.85rem',
  border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
  borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? 'white' : 'var(--foreground-muted)', transition: 'all 0.15s',
});
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.7rem 1.4rem', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.9rem',
  opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
});
const secondaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.7rem 1.2rem', borderRadius: 10, border: '1.5px solid var(--border)',
  background: 'transparent', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.88rem',
  cursor: 'pointer',
};
