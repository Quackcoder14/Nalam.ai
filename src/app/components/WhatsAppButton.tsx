'use client';
import { MessageCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface WhatsAppButtonProps {
  phoneNumber?: string;
  message: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  allowRecipientChoice?: boolean;
}

export default function WhatsAppButton({ phoneNumber, message, label, className, style, allowRecipientChoice = false }: WhatsAppButtonProps) {
  const { t } = useLanguage();
  
  const handleClick = () => {
    if (allowRecipientChoice || !phoneNumber) {
      // Open WhatsApp with pre-filled message, let user choose recipient
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      // Send to specific phone number
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.55rem 1rem',
        borderRadius: 8,
        background: '#25D366',
        color: 'white',
        border: 'none',
        fontWeight: 700,
        fontSize: '0.84rem',
        cursor: 'pointer',
        textDecoration: 'none',
        ...style,
      }}
    >
      <MessageCircle size={16} />
      {label || t('whatsapp.sendVia')}
    </button>
  );
}
