'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Trash2, X, FileText, Image as ImageIcon,
  FolderOpen, File, Download, Clock, HardDrive, ScanLine, Info,
  CheckCircle, AlertCircle, Plus, MessageSquare, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

type PatientFile = {
  id: string; filename: string; fileType: string; source: string;
  uploadedBy: string; fileSizeBytes: number; createdAt: string;
};

type FileWithData = PatientFile & { fileData: string };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function groupByMonth(files: PatientFile[]) {
  const groups: Record<string, PatientFile[]> = {};
  files.forEach(f => {
    const key = monthKey(f.createdAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });
  return groups;
}

function FileIcon({ type, size = 32 }: { type: string; size?: number }) {
  if (type === 'image') return <ImageIcon size={size} color="var(--accent-teal)" />;
  if (type === 'pdf') return <FileText size={size} color="var(--accent-red)" />;
  return <File size={size} color="var(--accent-purple)" />;
}

function SourceBadge({ source }: { source: string }) {
  const isScanner = source === 'document_scanner';
  const isPrescription = source === 'clinician';
  const isChatbot = source === 'chatbot';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
      background: isScanner ? 'var(--primary-light)' : isPrescription ? 'var(--accent-red-bg)' : isChatbot ? 'var(--accent-purple-bg)' : 'rgba(34,197,94,0.12)',
      color: isScanner ? 'var(--primary)' : isPrescription ? 'var(--accent-red)' : isChatbot ? 'var(--accent-purple)' : 'var(--accent-green)',
      border: `1px solid ${isScanner ? 'var(--primary)' : isPrescription ? 'var(--accent-red)' : isChatbot ? 'var(--accent-purple)' : 'var(--accent-green)'}`,
    }}>
      {isScanner ? <><ScanLine size={11} /> Document Scanner</> : isPrescription ? <><FileText size={11} /> Prescription</> : isChatbot ? <><MessageSquare size={11} /> AI Consultation</> : <><Upload size={11} /> Manual Upload</>}
    </span>
  );
}

/* ── File Viewer Popup ─────────────────────────────────────────────────────── */
function FileViewer({ file, onClose, onDelete }: { file: FileWithData; onClose: () => void; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const isImage = file.fileType === 'image' || file.fileData.startsWith('data:image');
  const isPdf = file.fileType === 'pdf' || file.fileData.includes('application/pdf');
  const isDocument = file.fileType === 'document';

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.filename}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/patient/files?id=${file.id}`, { method: 'DELETE' });
      if (res.ok) { onDelete(file.id); onClose(); }
      else alert('Failed to delete file.');
    } finally { setDeleting(false); }
  };

  // Get text content for documents (already decrypted from API)
  const getTextContent = () => {
    if (!isDocument || !file.fileData) return null;
    // The API already decrypts the content, so file.fileData is plain text
    // Only try to decode if it's a data URL (base64 encoded)
    if (file.fileData.startsWith('data:')) {
      try {
        const base64Data = file.fileData.split(',')[1];
        return atob(base64Data);
      } catch (e) {
        console.error('Error decoding base64:', e);
        return null;
      }
    }
    // Otherwise it's already plain text
    return file.fileData;
  };

  const textContent = getTextContent();

  // Debug logging
  console.log('File viewer debug:', {
    fileType: file.fileType,
    isDocument,
    hasFileData: !!file.fileData,
    fileDataLength: file.fileData?.length,
    textContentLength: textContent?.length,
    textContentPreview: textContent?.substring(0, 100),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}>
      <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: 'var(--surface)' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileIcon type={file.fileType} size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--deep-blue)', wordBreak: 'break-word' }}>{file.filename}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <SourceBadge source={file.source} />
              <span style={{ fontSize: '0.72rem', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} /> {formatDate(file.createdAt)}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <HardDrive size={11} /> {formatBytes(file.fileSizeBytes)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <a href={file.fileData} download={file.filename} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', textDecoration: 'none' }}>
              <Download size={16} />
            </a>
            {file.source === 'manual' && (
              <button onClick={handleDelete} disabled={deleting} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--accent-red)', background: 'var(--accent-red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-red)', cursor: 'pointer' }}>
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem', background: 'var(--surface-muted)' }}>
          {isImage && (
            <img src={file.fileData} alt={file.filename} style={{ maxWidth: '100%', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
          )}
          {isPdf && (
            <iframe src={file.fileData} title={file.filename} style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 8 }} />
          )}
          {isDocument && textContent && (
            <div style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: '1px solid var(--border)'
            }}>
              {textContent}
            </div>
          )}
          {!isImage && !isPdf && !isDocument && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--charcoal)' }}>
              <File size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
              <p>Preview not available for this file type.</p>
              <a href={file.fileData} download={file.filename} style={{ color: 'var(--primary)', fontWeight: 600 }}>Download to view</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Gallery Page ─────────────────────────────────────────────────────── */
export default function RecordsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<FileWithData | null>(null);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPatientId = () =>
    sessionStorage.getItem('nalamPatientId') || localStorage.getItem('nalamPatientId') || 'P001';

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/patient/files?patientId=${getPatientId()}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch { setError('Failed to load records.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const openFile = async (file: PatientFile) => {
    setLoadingFile(file.id);
    try {
      const res = await apiFetch(`/api/patient/files/${file.id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingFile(data);
      } else { setError('Failed to load file.'); }
    } catch { setError('Failed to load file.'); }
    finally { setLoadingFile(null); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';

    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }

    setUploading(true);
    setUploadProgress('Reading file…');
    try {
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = e => resolve(e.target!.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

      setUploadProgress('Uploading…');
      const fileType = f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'document';
      const res = await apiFetch('/api/patient/files', {
        method: 'POST',
        body: JSON.stringify({
          patientId: getPatientId(),
          filename: f.name,
          fileType,
          fileData,
          source: 'manual',
        }),
      });

      if (res.ok) { await loadFiles(); setUploadProgress(''); }
      else { const d = await res.json(); setError(d.error || 'Upload failed'); }
    } catch { setError('Upload failed. Please try again.'); }
    finally { setUploading(false); setUploadProgress(''); }
  };

  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'name':
        comparison = a.filename.localeCompare(b.filename);
        break;
      case 'size':
        comparison = a.fileSizeBytes - b.fileSizeBytes;
        break;
      case 'type':
        comparison = a.fileType.localeCompare(b.fileType);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const grouped = groupByMonth(sortedFiles);
  const months = Object.keys(grouped);

  return (
    <div className="container fade-in" style={{ maxWidth: 900, paddingBottom: '4rem' }}>
      <style>{`
        .record-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
          padding: 0.75rem; cursor: pointer; transition: all 0.2s; display: flex;
          align-items: center; gap: 0.75rem;
        }
        .record-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,82,165,0.1); border-color: var(--primary); }
        .record-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
        @media (max-width: 600px) { .record-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--deep-blue)', marginBottom: 2 }}>
            <FolderOpen size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            My Records
          </h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem' }}>
            {files.length} file{files.length !== 1 ? 's' : ''} stored · Encrypted & secure
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'size' | 'type')}
              style={{
                appearance: 'none',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.4rem 2rem 0.4rem 0.7rem',
                fontSize: '0.78rem',
                color: 'var(--foreground)',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
              <option value="type">Sort by Type</option>
            </select>
            <ChevronDown
              size={12}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--foreground-muted)',
              }}
            />
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="glass-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.7rem',
              fontSize: '0.78rem',
            }}
          >
            <ArrowUpDown size={12} style={{ transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none' }} />
            {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.65rem 1.1rem',
              background: 'linear-gradient(135deg,#0052A5,#0073D9)', color: 'white',
              border: 'none', borderRadius: 12, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.7 : 1, fontSize: '0.88rem', fontFamily: 'inherit',
            }}
          >
            {uploading ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> {uploadProgress}</> : <><Plus size={16} /> Upload File</>}
          </button>
        </div>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--charcoal)' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          Loading your records…
        </div>
      ) : files.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <FolderOpen size={56} color="var(--primary)" style={{ opacity: 0.3, marginBottom: 16 }} />
          <h3 style={{ color: 'var(--deep-blue)', marginBottom: 8 }}>No records yet</h3>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Upload prescriptions, lab reports, or scan documents from the Hospital Desk.
          </p>
          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg,#0052A5,#0073D9)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Upload size={16} /> Upload your first file
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {months.map(month => (
            <div key={month}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                {month}
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div className="record-grid">
                {grouped[month].map(file => (
                  <div
                    key={file.id}
                    className="record-card"
                    onClick={() => loadingFile !== file.id && openFile(file)}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', position: 'relative' }}
                  >
                    {/* Thumbnail area */}
                    <div style={{ width: '100%', height: 80, borderRadius: 10, background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' }}>
                      {loadingFile === file.id ? (
                        <div style={{ width: 24, height: 24, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      ) : (
                        <FileIcon type={file.fileType} size={36} />
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--deep-blue)', wordBreak: 'break-word', lineHeight: 1.3, marginBottom: 4 }}>
                      {file.filename.length > 30 ? file.filename.slice(0, 28) + '…' : file.filename}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--charcoal)' }}>
                      {new Date(file.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      &nbsp;·&nbsp;{formatBytes(file.fileSizeBytes)}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <SourceBadge source={file.source} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload tip */}
      {files.length > 0 && (
        <div style={{ marginTop: '2rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'var(--surface-muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--charcoal)' }}>
          <Info size={14} style={{ flexShrink: 0 }} />
          Files are end-to-end encrypted. Only you (and providers you share your OTP with) can view them.
        </div>
      )}

      {viewingFile && (
        <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} onDelete={handleDelete} />
      )}
    </div>
  );
}
