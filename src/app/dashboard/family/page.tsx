'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CheckCircle, XCircle, Clock, Trash2, Shield, RefreshCw, UserCheck, AlertTriangle
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

type FamilyLink = {
  id: string;
  familyId: string;
  familyName: string;
  nickname: string | null;
  relation: string | null;
  status: 'pending' | 'approved' | 'revoked';
  inviteCode: string | null;
  inviteCodeExpiresAt: string | null;
  requestedAt: string;
  consentedAt: string | null;
};

export default function PatientFamilyPage() {
  const router = useRouter();
  const [links, setLinks] = useState<FamilyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/patient/family-links');
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load'); return; }
      setLinks(data.links || []);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleApprove = async (linkId: string) => {
    setActionLoading(linkId + '_approve');
    try {
      const res = await apiFetch('/api/patient/family-links', {
        method: 'PATCH',
        body: JSON.stringify({ linkId, action: 'approve' }),
      });
      if (res.ok) await fetchLinks();
    } finally { setActionLoading(null); }
  };

  const handleRevoke = async (linkId: string) => {
    setActionLoading(linkId + '_revoke');
    try {
      const res = await apiFetch('/api/patient/family-links', {
        method: 'PATCH',
        body: JSON.stringify({ linkId, action: 'revoke' }),
      });
      if (res.ok) await fetchLinks();
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to remove this request?')) return;
    setActionLoading(linkId + '_delete');
    try {
      const res = await apiFetch(`/api/patient/family-links?linkId=${linkId}`, { method: 'DELETE' });
      if (res.ok) await fetchLinks();
    } finally { setActionLoading(null); }
  };

  const pending = links.filter(l => l.status === 'pending');
  const approved = links.filter(l => l.status === 'approved');
  const revoked = links.filter(l => l.status === 'revoked');

  const isExpired = (dt: string | null) => dt ? new Date(dt) < new Date() : false;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem 6rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.2rem' }}>
            Family Members
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)' }}>
            Manage who can access your health data
          </p>
        </div>
        <button
          onClick={fetchLinks}
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--charcoal)' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--charcoal)' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          Loading family members...
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '1rem 1.25rem', color: '#B91C1C', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Pending Requests */}
          {pending.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Clock size={16} color="#D97706" />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Pending Requests
                </h2>
                <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 700, borderRadius: 20, padding: '0.15rem 0.6rem' }}>
                  {pending.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {pending.map(link => (
                  <div key={link.id} style={{ background: 'var(--surface)', border: '1.5px solid #FDE68A', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>{link.familyName}</div>
                        {link.relation && <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginTop: '0.15rem' }}>as your <strong>{link.relation}</strong></div>}
                        {link.nickname && <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>Nickname: {link.nickname}</div>}
                        <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: '0.35rem' }}>
                          Requested {new Date(link.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      {/* OTP Box */}
                      {link.inviteCode && (
                        <div style={{ flexShrink: 0, background: isExpired(link.inviteCodeExpiresAt) ? 'var(--surface-muted)' : '#0052A5', borderRadius: 14, padding: '0.75rem 1rem', textAlign: 'center', minWidth: 120 }}>
                          <div style={{ fontSize: '0.62rem', color: isExpired(link.inviteCodeExpiresAt) ? 'var(--charcoal)' : 'rgba(255,255,255,0.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
                            {isExpired(link.inviteCodeExpiresAt) ? 'Expired Code' : 'One-Time Code'}
                          </div>
                          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: isExpired(link.inviteCodeExpiresAt) ? 'var(--charcoal)' : 'white', letterSpacing: '0.3em', fontFamily: 'monospace' }}>
                            {link.inviteCode}
                          </div>
                          {!isExpired(link.inviteCodeExpiresAt) && (
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.2rem' }}>
                              Share with family member
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleApprove(link.id)}
                        disabled={!!actionLoading}
                        style={{ flex: 1, padding: '0.65rem', background: 'linear-gradient(135deg, #059669, #10B981)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: actionLoading ? 0.6 : 1 }}
                      >
                        <UserCheck size={14} /> {actionLoading === link.id + '_approve' ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        disabled={!!actionLoading}
                        style={{ flex: 1, padding: '0.65rem', background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FECACA', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: actionLoading ? 0.6 : 1 }}
                      >
                        <XCircle size={14} /> {actionLoading === link.id + '_delete' ? 'Removing...' : 'Deny'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Approved Connections */}
          {approved.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CheckCircle size={16} color="#059669" />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Active Access
                </h2>
                <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '0.75rem', fontWeight: 700, borderRadius: 20, padding: '0.15rem 0.6rem' }}>
                  {approved.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {approved.map(link => (
                  <div key={link.id} style={{ background: 'var(--surface)', border: '1.5px solid #BBF7D0', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={20} color="white" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>{link.familyName}</div>
                          {link.relation && <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{link.relation}</div>}
                          {link.consentedAt && (
                            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.1rem', fontWeight: 600 }}>
                              ✓ Approved {new Date(link.consentedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevoke(link.id)}
                        disabled={!!actionLoading}
                        style={{ padding: '0.5rem 1rem', background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FECACA', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
                      >
                        <Trash2 size={13} /> Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {pending.length === 0 && approved.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--surface)', borderRadius: 20, border: '1.5px dashed var(--border)' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Users size={32} color="var(--charcoal)" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No family connections yet</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)', lineHeight: 1.6 }}>
                When a family member requests access to your health data, you'll see them here. You can approve or deny their request.
              </p>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
