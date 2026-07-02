'use client';

import { useState } from 'react';
import { Plus, Trash2, Upload, FileText } from 'lucide-react';

interface PrescriptionItem {
  id: string;
  name: string;
  dosage: string;
  quantity: string;
  days: string;
  morning: { enabled: boolean; timing: 'before' | 'after' | null };
  afternoon: { enabled: boolean; timing: 'before' | 'after' | null };
  night: { enabled: boolean; timing: 'before' | 'after' | null };
  instructions: string;
}

interface PrescriptionTableProps {
  patientId: string;
  patientName: string;
  onUploadToRecords: (prescription: any) => void;
}

export default function PrescriptionTable({ patientId, patientName, onUploadToRecords }: PrescriptionTableProps) {
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const addItem = () => {
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      name: '',
      dosage: '',
      quantity: '',
      days: '',
      morning: { enabled: false, timing: null },
      afternoon: { enabled: false, timing: null },
      night: { enabled: false, timing: null },
      instructions: '',
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PrescriptionItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const updateTiming = (id: string, period: 'morning' | 'afternoon' | 'night', field: 'enabled' | 'timing', value: any) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, [period]: { ...item[period], [field]: value } }
        : item
    ));
  };

  const handleUploadToRecords = async () => {
    const validItems = items.filter(item => item.name && item.quantity && item.days);
    if (validItems.length === 0) {
      alert('Please add at least one medication with name, quantity, and days');
      return;
    }

    setUploading(true);
    try {
      const prescription = {
        patientId,
        patientName,
        date: new Date().toISOString(),
        medications: validItems.map(item => ({
          name: item.name,
          dosage: item.dosage,
          quantity: item.quantity,
          days: item.days,
          schedule: {
            morning: item.morning.enabled ? item.morning.timing : null,
            afternoon: item.afternoon.enabled ? item.afternoon.timing : null,
            night: item.night.enabled ? item.night.timing : null,
          },
          instructions: item.instructions,
        })),
      };

      await onUploadToRecords(prescription);
      setItems([]);
    } catch (error) {
      console.error('Failed to upload prescription:', error);
      alert('Failed to upload prescription. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const TimingToggle = ({ enabled, timing, onToggle, onTimingChange }: {
    enabled: boolean;
    timing: 'before' | 'after' | null;
    onToggle: () => void;
    onTimingChange: (timing: 'before' | 'after') => void;
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        style={{ cursor: 'pointer' }}
      />
      {enabled && (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => onTimingChange('before')}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: timing === 'before' ? '#0052A5' : 'white',
              color: timing === 'before' ? 'white' : '#4A5568',
              cursor: 'pointer',
            }}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => onTimingChange('after')}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: timing === 'after' ? '#0052A5' : 'white',
              color: timing === 'after' ? 'white' : '#4A5568',
              cursor: 'pointer',
            }}
          >
            After
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: 'clamp(0.9rem, 2vw, 1rem)' }}>
          <FileText size={18} color="#0052A5" /> Prescription
        </h4>
        <button
          type="button"
          onClick={addItem}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.85rem',
            background: '#0052A5',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} /> Add Medication
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#F8FAFC',
          borderRadius: 8,
          border: '2px dashed #E2E8F0',
          color: '#94A3B8',
        }}>
          No medications added. Click "Add Medication" to start.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <div key={item.id} style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.25rem' }}>Medication Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Medicine name"
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.5rem',
                        border: '1px solid #E2E8F0',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.25rem' }}>Dosage</label>
                    <input
                      type="text"
                      value={item.dosage}
                      onChange={(e) => updateItem(item.id, 'dosage', e.target.value)}
                      placeholder="e.g., 5mg"
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.5rem',
                        border: '1px solid #E2E8F0',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.25rem' }}>Qty</label>
                      <input
                        type="text"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        placeholder="Qty"
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.5rem',
                          border: '1px solid #E2E8F0',
                          borderRadius: 4,
                          fontSize: '0.8rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.25rem' }}>Days</label>
                      <input
                        type="text"
                        value={item.days}
                        onChange={(e) => updateItem(item.id, 'days', e.target.value)}
                        placeholder="Days"
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.5rem',
                          border: '1px solid #E2E8F0',
                          borderRadius: 4,
                          fontSize: '0.8rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  style={{
                    padding: '0.3rem',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#DC2626',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.25rem' }}>Schedule</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#4A5568', minWidth: 70 }}>Morning:</span>
                    <TimingToggle
                      enabled={item.morning.enabled}
                      timing={item.morning.timing}
                      onToggle={() => updateTiming(item.id, 'morning', 'enabled', !item.morning.enabled)}
                      onTimingChange={(timing) => updateTiming(item.id, 'morning', 'timing', timing)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#4A5568', minWidth: 70 }}>Afternoon:</span>
                    <TimingToggle
                      enabled={item.afternoon.enabled}
                      timing={item.afternoon.timing}
                      onToggle={() => updateTiming(item.id, 'afternoon', 'enabled', !item.afternoon.enabled)}
                      onTimingChange={(timing) => updateTiming(item.id, 'afternoon', 'timing', timing)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#4A5568', minWidth: 70 }}>Night:</span>
                    <TimingToggle
                      enabled={item.night.enabled}
                      timing={item.night.timing}
                      onToggle={() => updateTiming(item.id, 'night', 'enabled', !item.night.enabled)}
                      onTimingChange={(timing) => updateTiming(item.id, 'night', 'timing', timing)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.25rem' }}>Instructions</label>
                <input
                  type="text"
                  value={item.instructions}
                  onChange={(e) => updateItem(item.id, 'instructions', e.target.value)}
                  placeholder="Instructions"
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.5rem',
                    border: '1px solid #E2E8F0',
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <button
          type="button"
          onClick={handleUploadToRecords}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: uploading ? '#94A3B8' : 'linear-gradient(135deg,#0052A5,#0073D9)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: uploading ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          <Upload size={18} />
          {uploading ? 'Uploading...' : 'Upload to Records'}
        </button>
      )}
    </div>
  );
}
