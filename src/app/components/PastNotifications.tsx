'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Clock, Trash2, RefreshCw, Bell } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

interface PastNotificationsProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  isHospitalDesk?: boolean;
}

export default function PastNotifications({ isOpen, onClose, patientId, isHospitalDesk = false }: PastNotificationsProps) {
  const { t, lang } = useLanguage();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchPastAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ past: '1', lang });
      if (patientId) params.append('patientId', patientId);
      
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch past notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, lang]);

  useEffect(() => {
    if (isOpen) {
      fetchPastAlerts();
    }
  }, [isOpen, fetchPastAlerts]);

  const clearAllAlerts = async () => {
    if (!confirm(t('pastNotifications.clearConfirm'))) return;
    
    setClearing(true);
    try {
      // Delete all past alerts
      const deletePromises = alerts.map(alert => 
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: alert.id }),
        })
      );
      
      await Promise.all(deletePromises);
      await fetchPastAlerts();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      alert(t('pastNotifications.clearError'));
    } finally {
      setClearing(false);
    }
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const groupAlertsByDate = (alerts: any[]) => {
    const groups: Record<string, any[]> = {};
    alerts.forEach(alert => {
      const date = new Date(alert.created_at).toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(alert);
    });
    return groups;
  };

  const groupedAlerts = groupAlertsByDate(alerts);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
      <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--deep-blue)', margin: 0 }}>
              {t('pastNotifications.title')}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', padding: '0.3rem', borderRadius: 6 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>{t('pastNotifications.loading')}</span>
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--charcoal)' }}>
              <Bell size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('pastNotifications.noNotifications')}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>{t('pastNotifications.noNotificationsDesc')}</p>
            </div>
          ) : (
            <>
              {/* Clear All Button */}
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={clearAllAlerts}
                  disabled={clearing}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: 6, 
                    background: clearing ? 'var(--surface-muted)' : '#FFEBEE', 
                    color: clearing ? 'var(--foreground-muted)' : '#C62828', 
                    border: '1px solid rgba(198,40,40,0.3)', 
                    fontWeight: 600, 
                    fontSize: '0.8rem', 
                    cursor: clearing ? 'not-allowed' : 'pointer' 
                  }}
                >
                  <Trash2 size={14} />
                  {clearing ? t('pastNotifications.clearing') : t('pastNotifications.clearAll')}
                </button>
              </div>

              {/* Grouped Alerts */}
              {Object.entries(groupedAlerts).map(([date, dateAlerts]) => (
                <div key={date} style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', padding: '0 0.5rem' }}>
                    {date}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dateAlerts.map(alert => (
                      <div
                        key={alert.id}
                        style={{ 
                          padding: '1rem', 
                          borderRadius: 10, 
                          border: '1px solid var(--border)', 
                          background: 'var(--surface-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: '50%', 
                            background: 'var(--primary-light)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Bell size={16} color="var(--primary)" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--deep-blue)', marginBottom: '0.25rem' }}>
                              {alert.title}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                              {alert.message}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                              <Clock size={12} />
                              {formatDateTime(alert.created_at)}
                              {alert.patient_id && !isHospitalDesk && (
                                <span>· ID: {alert.patient_id}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={fetchPastAlerts}
            disabled={loading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              padding: '0.5rem 1rem', 
              borderRadius: 8, 
              background: 'var(--surface-muted)', 
              color: 'var(--foreground)', 
              border: '1px solid var(--border)', 
              fontWeight: 600, 
              fontSize: '0.85rem', 
              cursor: loading ? 'not-allowed' : 'pointer' 
            }}
          >
            <RefreshCw size={14} />
            {t('pastNotifications.refresh')}
          </button>
        </div>
      </div>
    </div>
  );
}
