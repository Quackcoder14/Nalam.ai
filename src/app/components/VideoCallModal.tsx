'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, PhoneCall, Loader2, User } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'caller' | 'callee';
  type: 'video' | 'audio';
  patientId?: string;
  hospital?: string;
  callId?: string;
  initialOffer?: any;
}

// ICE candidate buffer - holds candidates generated before call_id is known
const iceCandidateBuffer: RTCIceCandidateInit[] = [];

export default function VideoCallModal({
  isOpen,
  onClose,
  mode,
  type,
  patientId,
  hospital = 'Hospital Desk',
  callId: initialCallId,
  initialOffer,
}: VideoCallModalProps) {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // All mutable/async state in refs to avoid stale closures
  const pcRef        = useRef<RTCPeerConnection | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const callIdRef    = useRef<string | null>(initialCallId || null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIceRef   = useRef<number>(0);
  const mountedRef   = useRef<boolean>(false);

  // Purely for UI rendering
  const [status, setStatus]       = useState<'connecting'|'ringing'|'connected'|'ended'|'failed'>('connecting');
  const [isMuted,    setIsMuted]   = useState(false);
  const [isVideoOff, setIsVOff]    = useState(false);
  const [seconds,    setSeconds]   = useState(0);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  /* ──────────────────────────────────────────────────────────────────────
   * TEARDOWN - safe to call any number of times
   * ────────────────────────────────────────────────────────────────────── */
  const teardown = useCallback(async (notify = true) => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (notify && callIdRef.current) {
      try {
        await apiFetch('/api/webrtc', {
          method: 'PUT',
          body: JSON.stringify({ call_id: callIdRef.current, status: 'ended' }),
        });
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack          = null;
      pcRef.current.onicecandidate   = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (mountedRef.current) {
      setStatus('ended');
      setTimeout(() => { if (mountedRef.current) onClose(); }, 1000);
    }
  }, [onClose]);

  /* ──────────────────────────────────────────────────────────────────────
   * Flush buffered ICE candidates to server once call_id is known
   * ────────────────────────────────────────────────────────────────────── */
  const flushIceBuffer = useCallback(async (cid: string) => {
    while (iceCandidateBuffer.length > 0) {
      const candidate = iceCandidateBuffer.shift()!;
      try {
        await apiFetch('/api/webrtc', {
          method: 'PATCH',
          body: JSON.stringify({ call_id: cid, candidate, side: mode }),
        });
      } catch {}
    }
  }, [mode]);

  /* ──────────────────────────────────────────────────────────────────────
   * POLLING - runs every 2s to sync signaling state from DB
   * ────────────────────────────────────────────────────────────────────── */
  const startPolling = useCallback((cid: string, getIsMounted: () => boolean) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      if (!getIsMounted()) return;
      try {
        const res  = await apiFetch(`/api/webrtc?call_id=${cid}`);
        const data = await res.json();
        if (!data.call) return;
        const call = data.call;

        // Remote hung up
        if (call.status === 'ended' || call.status === 'rejected') {
          await teardown(false); // don't re-notify server
          return;
        }

        // Caller: consume answer once callee accepts
        if (
          mode === 'caller' &&
          call.status === 'accepted' &&
          call.answer_json &&
          pcRef.current?.signalingState === 'have-local-offer'
        ) {
          const answer = JSON.parse(call.answer_json) as RTCSessionDescriptionInit;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          if (getIsMounted()) {
            setStatus('connected');
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
          }
        }

        // Consume remote ICE candidates
        const rawIce = mode === 'caller' ? call.ice_callee_json : call.ice_caller_json;
        if (rawIce && pcRef.current?.remoteDescription) {
          const candidates: RTCIceCandidateInit[] = JSON.parse(rawIce);
          for (let i = lastIceRef.current; i < candidates.length; i++) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidates[i]));
            } catch {}
          }
          lastIceRef.current = candidates.length;
        }
      } catch {}
    }, 2000);
  }, [mode, teardown]);

  /* ──────────────────────────────────────────────────────────────────────
   * MAIN INIT EFFECT - runs once when modal opens
   * ────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    
    // StrictMode fix: use local variable for mounted state instead of shared ref
    let isMounted = true;
    mountedRef.current = true; // Still keep ref updated for teardown function
    lastIceRef.current = 0;
    iceCandidateBuffer.length = 0; // clear buffer on each call

    const init = async () => {
      try {
        // 1. Acquire media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl:  true,
          },
        });
        
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
        
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302'  },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        });
        
        if (!isMounted) { pc.close(); return; }
        pcRef.current = pc;

        // 3. Add local tracks
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // 4. Receive remote stream
        pc.ontrack = (ev) => {
          const [remoteStream] = ev.streams;
          if (!remoteStream || !remoteVideoRef.current) return;
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {
              // Some browsers block autoplay - add a click handler as fallback
              const resume = () => {
                remoteVideoRef.current?.play().catch(() => {});
                document.removeEventListener('click', resume);
              };
              document.addEventListener('click', resume, { once: true });
            });
          }
        };

        // 5. ICE candidate handler - BUFFER until call_id is known
        pc.onicecandidate = async (ev) => {
          if (!ev.candidate) return;
          if (callIdRef.current) {
            // call_id already known - send immediately
            try {
              await apiFetch('/api/webrtc', {
                method: 'PATCH',
                body: JSON.stringify({
                  call_id: callIdRef.current,
                  candidate: ev.candidate,
                  side: mode,
                }),
              });
            } catch {}
          } else {
            // call_id not yet known - buffer the candidate
            iceCandidateBuffer.push(ev.candidate.toJSON());
          }
        };

        // CALLER FLOW
        if (mode === 'caller') {
          if (isMounted) setStatus('connecting');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // POST call to server -> get call_id
          const res = await apiFetch('/api/webrtc', {
            method: 'POST',
            body: JSON.stringify({ patient_id: patientId, hospital, type, offer }),
          });
          if (!res.ok) throw new Error('Server rejected call creation');
          
          if (!isMounted) return;
          
          const { call_id } = await res.json();

          // Now call_id is known - set ref and flush buffered candidates
          callIdRef.current = call_id;
          await flushIceBuffer(call_id);

          if (isMounted) setStatus('ringing');
          startPolling(call_id, () => isMounted);
        }

        // CALLEE FLOW
        else if (mode === 'callee' && initialOffer && initialCallId) {
          callIdRef.current = initialCallId; // set immediately so ICE candidates go out
          await pc.setRemoteDescription(new RTCSessionDescription(initialOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          if (!isMounted) return;

          await apiFetch('/api/webrtc', {
            method: 'PUT',
            body: JSON.stringify({ call_id: initialCallId, answer, status: 'accepted' }),
          });

          if (isMounted) {
            setStatus('connected');
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
          }
          startPolling(initialCallId, () => isMounted);
        }

      } catch (err) {
        console.error('[VideoCall] Init error:', err);
        if (isMounted) setStatus('failed');
        setTimeout(() => { if (isMounted) onClose(); }, 3000);
      }
    };

    init();

    return () => {
      isMounted = false;
      mountedRef.current = false;
      if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (pcRef.current)    { pcRef.current.close(); pcRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const label = mode === 'caller' ? hospital : 'Patient';

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(26,43,74,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }} />

      {/* ── Centered popup card ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9001,
        width: type === 'video' ? 520 : 360,
        maxWidth: '94vw',
        background: 'var(--glass-bg)',
        border: '1.5px solid var(--glass-border)',
        borderRadius: 28,
        boxShadow: '0 32px 80px rgba(26,43,74,0.22), 0 0 0 1px rgba(0,82,165,0.07)',
        overflow: 'hidden',
        animation: 'vcPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ── Video strip (video calls only) ─────────────────────────────── */}
        {type === 'video' && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: 'var(--deep-blue)', overflow: 'hidden' }}>
            {/* Remote (main) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Placeholder */}
            {status !== 'connected' && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 12, background: 'var(--deep-blue)',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(165,216,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={34} style={{ color: 'rgba(165,216,255,0.5)' }} />
                </div>
                <p style={{ color: 'rgba(165,216,255,0.5)', fontSize: 13, margin: 0 }}>{label}</p>
              </div>
            )}
            {/* Local PiP */}
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              width: 110, aspectRatio: '4/3',
              borderRadius: 12, overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.18)',
              background: '#111',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        )}

        {/* ── Info section ────────────────────────────────────────────────── */}
        <div style={{
          padding: type === 'video' ? '20px 28px 0' : '44px 28px 0',
          textAlign: 'center',
        }}>
          {/* Avatar for audio-only calls */}
          {type === 'audio' && (
            <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 18px' }}>
              {/* Pulsing ring */}
              {status === 'ringing' && (
                <>
                  <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '2px solid rgba(0,82,165,0.2)', animation: 'ringPulse 1.6s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: -7,  borderRadius: '50%', border: '2px solid rgba(0,82,165,0.35)', animation: 'ringPulse 1.6s ease-out 0.4s infinite' }} />
                </>
              )}
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--powder-blue-dark) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: status === 'connected' ? '0 0 0 6px rgba(0,82,165,0.15)' : 'none',
                transition: 'box-shadow 0.4s',
              }}>
                <User size={38} style={{ color: 'white' }} />
              </div>
            </div>
          )}

          <h2 style={{ color: 'var(--deep-blue)', fontWeight: 700, fontSize: 19, margin: 0, marginBottom: 6 }}>
            {label}
          </h2>

          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: type === 'video' ? 16 : 0 }}>
            {status === 'connecting' && <>
              <Loader2 size={13} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'var(--charcoal)', fontSize: 13 }}>Connecting...</span>
            </>}
            {status === 'ringing' && <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-amber)', display: 'inline-block', animation: 'blink 1s ease-in-out infinite' }} />
              <span style={{ color: 'var(--accent-amber)', fontSize: 13 }}>Ringing...</span>
            </>}
            {status === 'connected' && <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', animation: 'blink 2s ease-in-out infinite' }} />
              <span style={{ color: 'var(--accent-green)', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(seconds)}</span>
            </>}
            {status === 'ended' && <span style={{ color: 'var(--accent-red)', fontSize: 13 }}>Call ended</span>}
            {status === 'failed' && <span style={{ color: 'var(--accent-red)', fontSize: 13 }}>Failed - check mic/camera permissions</span>}
          </div>
        </div>

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '24px 28px 32px',
        }}>

          {/* Mute */}
          <button
            onClick={() => {
              if (!streamRef.current) return;
              streamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
              setIsMuted(m => !m);
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{
              width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isMuted ? 'var(--deep-blue)' : 'var(--surface-muted)',
              color:      isMuted ? 'white' : 'var(--charcoal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isMuted ? '0 4px 14px rgba(26,43,74,0.25)' : '0 2px 8px rgba(26,43,74,0.08)',
              transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   }}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* ── End call — centre, larger ── */}
          <button
            onClick={() => teardown(true)}
            title="End call"
            style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent-red) 0%, #B71C1C 100%)',
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(198,40,40,0.4)',
              transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(198,40,40,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 8px 24px rgba(198,40,40,0.4)'; }}
          >
            <PhoneOff size={24} />
          </button>

          {/* Camera toggle */}
          {type === 'video' && (
            <button
              onClick={() => {
                if (!streamRef.current) return;
                streamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
                setIsVOff(v => !v);
              }}
              title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              style={{
                width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: isVideoOff ? 'var(--deep-blue)' : 'var(--surface-muted)',
                color:      isVideoOff ? 'white' : 'var(--charcoal)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isVideoOff ? '0 4px 14px rgba(26,43,74,0.25)' : '0 2px 8px rgba(26,43,74,0.08)',
                transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   }}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          )}

          {/* Spacer for audio calls (keeps end-call centred) */}
          {type === 'audio' && <div style={{ width: 52 }} />}
        </div>
      </div>

      <style>{`
        @keyframes vcPopIn {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.86); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes ringPulse {
          from { opacity: 0.7; transform: scale(1); }
          to   { opacity: 0;   transform: scale(1.6); }
        }
      `}</style>
    </>
  );
}
