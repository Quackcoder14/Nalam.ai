'use client';
import { useState } from 'react';
import { X, ShieldCheck, FolderOpen, Loader2, FileText, Image as ImageIcon, File, ScanLine, Upload, Clock, HardDrive } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

type FileMeta = {
  id: string; filename: string; fileType: string; source: string;
  uploadedBy: string; fileSizeBytes: number; createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type, size = 28 }: { type: string; size?: number }) {
  if (type === 'image') return <ImageIcon size={size} color="#0097A7" />;
  if (type === 'pdf') return <FileText size={size} color="#E53E3E" />;
  return <File size={size} color="#5C35A1" />;
}

type Phase = 'idle' | 'sending' | 'enter_otp' | 'verifying' | 'viewing' | 'viewing_file' | 'error';

export function RecordsOtpModal({
  patientId,
  patientName,
  requestorId,
  requestorName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  requestorId: string;
  requestorName: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [viewFile, setViewFile] = useState<any>(null);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sendOtp = async () => {
    setPhase('sending');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/patient/records-otp', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', patientId, requestorName }),
      });
      if (res.ok) {
        setPhase('enter_otp');
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to send OTP');
        setPhase('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPhase('error');
    }
  };

  const verifyOtp = async () => {
    if (otp.replace(/\s/g, '').length !== 6) return;
    setPhase('verifying');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/patient/records-otp', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', patientId, otp }),
      });
      const d = await res.json();
      if (d.valid) {
        setOtpToken(d.otpToken);
        // Fetch file list
        const fr = await apiFetch(`/api/patient/files?patientId=${patientId}`);
        if (fr.ok) {
          const fd = await fr.json();
          setFiles(fd.files || []);
        }
        setPhase('viewing');
      } else {
        setErrorMsg(d.error || 'Invalid or expired OTP');
        setPhase('enter_otp');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPhase('enter_otp');
    }
  };

  const openFile = async (file: FileMeta) => {
    setLoadingFileId(file.id);
    try {
      const res = await apiFetch(`/api/patient/files/${file.id}?otpToken=${otpToken}`);
      if (res.ok) {
        setViewFile(await res.json());
        setPhase('viewing_file');
      } else {
        setErrorMsg('Could not load file. Session may have expired.');
      }
    } catch {
      setErrorMsg('Failed to load file.');
    } finally {
      setLoadingFileId(null);
    }
  };

  const groupByMonth = (files: FileMeta[]) => {
    const groups: Record<string, FileMeta[]> = {};
    files.forEach(f => {
      const key = new Date(f.createdAt).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}>
      <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: phase === 'viewing' || phase === 'viewing_file' ? 660 : 420, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: 'var(--surface)' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#EBF4FF,#BFDBFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={22} color="#0052A5" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--deep-blue)', fontSize: '0.95rem' }}>
              {phase === 'viewing' || phase === 'viewing_file' ? `${patientName}'s Records` : 'View Patient Records'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: 2 }}>
              {(phase === 'viewing' || phase === 'viewing_file') ? `${files.length} file${files.length !== 1 ? 's' : ''} · Read-only` : `Patient: ${patientName} (${patientId})`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--charcoal)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>

          {/* Phase: idle */}
          {phase === 'idle' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
              <h3 style={{ color: 'var(--deep-blue)', marginBottom: 8 }}>Consent Required</h3>
              <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Clicking below will send a <strong>6-digit OTP</strong> as an in-app notification to <strong>{patientName}</strong>'s dashboard. Ask the patient for the code — it expires in <strong>2 minutes</strong>.
              </p>
              <button
                onClick={sendOtp}
                style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg,#0052A5,#0073D9)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <ShieldCheck size={18} /> Send OTP to Patient
              </button>
            </div>
          )}

          {/* Phase: sending */}
          {phase === 'sending' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--charcoal)' }}>Sending OTP to patient's device…</p>
            </div>
          )}

          {/* Phase: enter OTP */}
          {phase === 'enter_otp' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📲</div>
                <h3 style={{ color: 'var(--deep-blue)', marginBottom: 6 }}>OTP Sent!</h3>
                <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  The OTP has appeared on <strong>{patientName}</strong>'s dashboard. Ask them for the 6-digit code.
                </p>
              </div>
              {errorMsg && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {errorMsg}
                </div>
              )}
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9\s]/g, '').slice(0, 7))}
                onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                maxLength={7}
                style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '2px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', fontFamily: 'inherit', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
              />
              <button
                onClick={verifyOtp}
                disabled={otp.replace(/\s/g, '').length !== 6}
                style={{ width: '100%', padding: '0.85rem', background: otp.replace(/\s/g, '').length === 6 ? 'linear-gradient(135deg,#0052A5,#0073D9)' : 'var(--surface-muted)', color: otp.replace(/\s/g, '').length === 6 ? 'white' : 'var(--charcoal)', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', cursor: otp.replace(/\s/g, '').length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: '0.6rem' }}
              >
                Verify & View Records
              </button>
              <button onClick={sendOtp} style={{ width: '100%', padding: '0.6rem', background: 'none', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, fontSize: '0.82rem', color: 'var(--charcoal)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Resend OTP
              </button>
            </div>
          )}

          {/* Phase: verifying */}
          {phase === 'verifying' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--charcoal)' }}>Verifying OTP…</p>
            </div>
          )}

          {/* Phase: viewing files list */}
          {phase === 'viewing' && (
            <div>
              {files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <FolderOpen size={48} color="var(--primary)" style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ color: 'var(--charcoal)' }}>This patient has no uploaded records yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {Object.entries(groupByMonth(files)).map(([month, mfiles]) => (
                    <div key={month}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />{month}<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
                        {mfiles.map(f => (
                          <button
                            key={f.id}
                            onClick={() => openFile(f)}
                            disabled={loadingFileId === f.id}
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}
                          >
                            <div style={{ width: '100%', height: 60, borderRadius: 8, background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {loadingFileId === f.id
                                ? <div style={{ width: 20, height: 20, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                : <FileIcon type={f.fileType} size={28} />
                              }
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--deep-blue)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                              {f.filename.length > 24 ? f.filename.slice(0, 22) + '…' : f.filename}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={10} /> {new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              <span>·</span>{formatBytes(f.fileSizeBytes)}
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 20, fontSize: '0.62rem', fontWeight: 700, background: f.source === 'document_scanner' ? '#EBF4FF' : '#F0FFF4', color: f.source === 'document_scanner' ? '#0052A5' : '#276749' }}>
                              {f.source === 'document_scanner' ? <><ScanLine size={9} /> Scanner</> : <><Upload size={9} /> Manual</>}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Phase: viewing individual file */}
          {phase === 'viewing_file' && viewFile && (
            <div>
              <button onClick={() => setPhase('viewing')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem', padding: 0, fontSize: '0.85rem' }}>
                ← Back to list
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <FileIcon type={viewFile.fileType} size={28} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--deep-blue)', wordBreak: 'break-word' }}>{viewFile.filename}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {new Date(viewFile.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><HardDrive size={10} /> {formatBytes(viewFile.fileSizeBytes)}</span>
                  </div>
                </div>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#F8FAFC' }}>
                {(viewFile.fileType === 'image' || viewFile.fileData?.startsWith('data:image')) ? (
                  <img src={viewFile.fileData} alt={viewFile.filename} style={{ width: '100%', display: 'block' }} />
                ) : (viewFile.fileType === 'pdf' || viewFile.fileData?.includes('application/pdf')) ? (
                  <iframe src={viewFile.fileData} title={viewFile.filename} style={{ width: '100%', height: '50vh', border: 'none', display: 'block' }} />
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--charcoal)' }}>
                    <File size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ fontSize: '0.85rem' }}>Preview unavailable in staff view. Downloads are available only from the patient account.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phase: error */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#DC2626', marginBottom: '1.25rem' }}>{errorMsg}</p>
              <button onClick={() => setPhase('idle')} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
