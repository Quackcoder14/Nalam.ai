'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CalendarDays, Filter, CheckCircle, XCircle, Clock, AlertTriangle, Activity, FileText, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

const STATUS_COLORS: Record<string, string> = {
  pending: '#C07A00',
  approved: '#0052A5',
  scheduled: '#2E7D32',
  pending_reschedule: '#7C3AED',
  reschedule_accepted: '#2E7D32',
  reschedule_patient_rejected: '#71717A',
  rejected: '#C62828',
  cancelled: '#71717A',
};

const STATUS_BG: Record<string, string> = {
  pending: '#FFF8E1',
  approved: '#EBF3FF',
  scheduled: '#E8F5E9',
  pending_reschedule: '#F3E8FF',
  reschedule_accepted: '#E8F5E9',
  reschedule_patient_rejected: '#F4F4F5',
  rejected: '#FFEBEE',
  cancelled: '#F4F4F5',
};

const URGENCY_COLORS: Record<string, string> = {
  Routine: '#0097A7',
  Urgent: '#C07A00',
  Emergency: '#C62828',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DoctorCalendar() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments?all=true`);
      if (res.ok) setAppointments(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const uniqueDoctors = useMemo(() => {
    const doctors = new Set(appointments.map(apt => apt.doctorName).filter(Boolean));
    return Array.from(doctors).sort();
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    if (selectedDoctor !== 'all') {
      filtered = filtered.filter(apt => apt.doctorName === selectedDoctor);
    }
    // Only show scheduled or approved appointments (not pending ones)
    return filtered.filter(apt => apt.status === 'scheduled' || apt.status === 'approved');
  }, [appointments, selectedDoctor]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    const days: Date[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(new Date(year, month, 1 - startDayOfWeek + i));
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  }, [currentMonth]);

  const getAppointmentsForDay = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return filteredAppointments.filter(apt => apt.date === dateStr);
  };

  const handleAptAction = async (id: string, status: string, payload?: any) => {
    setProcessing(id);
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments`, {
        method: 'PATCH',
        body: JSON.stringify({ id, status, ...payload }),
      });
      await fetchAppointments();
    } finally { setProcessing(null); }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const dayAppointments = selectedDay ? getAppointmentsForDay(selectedDay) : [];

  return (
    <div className="container fade-in" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/hospital-desk')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={18} /> {t('nav.back')}
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 0 }}>{t('calendar.title')}</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem' }}>{t('calendar.subtitle')}</p>
        </div>
      </div>

      {/* Month Navigation & Filter */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => navigateMonth('prev')} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
              <ChevronLeft size={20} />
            </button>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--deep-blue)', minWidth: 200, textAlign: 'center' }}>
              {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => navigateMonth('next')} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--foreground-muted)" />
            <select
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <option value="all">{t('calendar.allDoctors')}</option>
              {uniqueDoctors.map(doc => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('calendar.loading')}</span>
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Day Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[t('calendar.sun'), t('calendar.mon'), t('calendar.tue'), t('calendar.wed'), t('calendar.thu'), t('calendar.fri'), t('calendar.sat')].map(day => (
                <div key={day} style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground-muted)' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
              {calendarDays.map((date, idx) => {
                const dayApts = getAppointmentsForDay(date);
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelected = selectedDay && date.toDateString() === selectedDay.toDateString();
                
                return (
                  <div
                    key={idx}
                    onClick={() => { if (dayApts.length > 0) setSelectedDay(date); }}
                    style={{
                      minHeight: 80,
                      padding: '0.5rem',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? 'var(--primary)' : isCurrentMonth ? 'var(--border)' : 'transparent'}`,
                      background: isSelected ? 'var(--primary-light)' : isCurrentMonth ? 'var(--surface)' : 'transparent',
                      cursor: dayApts.length > 0 ? 'pointer' : 'default',
                      opacity: isCurrentMonth ? 1 : 0.3,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isCurrentMonth ? 'var(--foreground)' : 'var(--foreground-muted)', marginBottom: '0.4rem' }}>
                      {date.getDate()}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {dayApts.slice(0, 3).map((apt, i) => (
                        <div
                          key={i}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: STATUS_COLORS[apt.status] || '#C07A00',
                            border: `1px solid ${STATUS_COLORS[apt.status] || '#C07A00'}44`,
                          }}
                          title={`${apt.doctorName} - ${apt.status}`}
                        />
                      ))}
                      {dayApts.length > 3 && (
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--foreground-muted)' }}>
                          +{dayApts.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day Detail Panel */}
          {selectedDay && (
            <div className="glass-panel slide-up" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--deep-blue)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarDays size={20} />
                  {(() => {
                    const year = selectedDay.getFullYear();
                    const month = String(selectedDay.getMonth() + 1).padStart(2, '0');
                    const day = String(selectedDay.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    return formatDate(dateStr);
                  })()}
                </h3>
                <button onClick={() => setSelectedDay(null)} style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  {t('calendar.close')}
                </button>
              </div>

              {dayAppointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--charcoal)' }}>
                  {t('calendar.noAppointments')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {dayAppointments.map(apt => {
                    const stColor = STATUS_COLORS[apt.status] || '#C07A00';
                    const stBg = STATUS_BG[apt.status] || '#FFF8E1';
                    const ucColor = URGENCY_COLORS[apt.urgency] || URGENCY_COLORS.Routine;
                    const ucBg = apt.urgency === 'Emergency' ? '#FFEBEE' : apt.urgency === 'Urgent' ? '#FFF8E1' : '#E0F7FA';
                    
                    return (
                      <div key={apt.id} style={{ padding: '1.25rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 250 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--deep-blue)' }}>{apt.patientName}</span>
                              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', borderRadius: 20, background: ucBg, color: ucColor, fontWeight: 700 }}>{apt.urgency}</span>
                              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', borderRadius: 20, background: stBg, color: stColor, fontWeight: 700 }}>{apt.status.replace('_', ' ').toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '0.5rem' }}>
                              <strong>{t('calendar.doctor')}:</strong> {apt.doctorName} · {apt.doctorSpecialty}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '0.5rem' }}>
                              <strong>{t('calendar.time')}:</strong> {apt.time || t('calendar.tbd')} · <strong>{t('calendar.ref')}:</strong> {apt.id}
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 2 }}>{t('calendar.patientReason')}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--foreground)' }}>{apt.reason}</div>
                            </div>
                            {apt.aiSummary && (
                              <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>{t('calendar.aiSummary')}</div>
                                <div style={{ fontSize: '0.85rem', padding: '0.5rem', background: 'var(--primary-light)', borderRadius: 6, color: 'var(--deep-blue)' }}>{apt.aiSummary}</div>
                              </div>
                            )}
                            {apt.vitalsSnapshot && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                {[
                                  ['❤️','HR',`${apt.vitalsSnapshot.hr}`,'#FCA5A5'],
                                  ['🫁','SpO₂',`${apt.vitalsSnapshot.spo2}%`,'#A5D8FF'],
                                  ['🩸','BP',`${apt.vitalsSnapshot.sys}/${apt.vitalsSnapshot.dia}`,'#C7D2FE']
                                ].map(([em,lb,vl,cl]) => (
                                  <span key={lb as string} style={{ padding: '0.2rem 0.5rem', borderRadius: 6, background: `${cl}22`, border: `1px solid ${cl}66`, fontSize: '0.75rem', fontWeight: 700 }}>{lb}: {vl}</span>
                                ))}
                              </div>
                            )}
                            {(apt.status === 'approved' || apt.status === 'pending') && (
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                {apt.status === 'approved' && (
                                  <button
                                    disabled={processing === apt.id}
                                    onClick={() => handleAptAction(apt.id, 'scheduled')}
                                    style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#2E7D32', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                  >
                                    {processing === apt.id ? t('calendar.updating') : t('calendar.schedule')}
                                  </button>
                                )}
                                {apt.status === 'pending' && (
                                  <>
                                    <button
                                      disabled={processing === apt.id}
                                      onClick={() => handleAptAction(apt.id, 'approved')}
                                      style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#0052A5', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                    >
                                      {processing === apt.id ? t('calendar.updating') : t('calendar.approve')}
                                    </button>
                                    <button
                                      disabled={processing === apt.id}
                                      onClick={() => handleAptAction(apt.id, 'rejected')}
                                      style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#C62828', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                    >
                                      {processing === apt.id ? t('calendar.updating') : t('calendar.reject')}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
