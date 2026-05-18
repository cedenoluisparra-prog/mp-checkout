import { CSSProperties } from 'react';
import { Payment } from '../../../domain/entities/Payment';

interface Props {
  payment: Payment;
  onReset: () => void;
}

export function SuccessScreen({ payment, onReset }: Props) {
  const displayAmount = payment.amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.checkCircle}>✓</div>
        <h2 style={s.title}>¡Pago aprobado!</h2>
        <p style={s.sub}>Tu transacción fue procesada exitosamente.</p>
        <div style={s.idBox}>
          <span style={s.idLabel}>Monto pagado</span>
          <span style={s.idValue}>{payment.currency} ${displayAmount}</span>
        </div>
        {payment.orderId && (
          <div style={s.idBox}>
            <span style={s.idLabel}>ID de orden</span>
            <span style={{ ...s.idValue, fontSize: 14 }}>{payment.orderId}</span>
          </div>
        )}
        <button style={s.btn} onClick={onReset}>Realizar otro pago</button>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 40px', background: 'var(--bg)' },
  card: { marginTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 360, width: '100%', textAlign: 'center' },
  checkCircle: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'rgba(0,200,120,0.15)', border: '2px solid var(--green)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, color: 'var(--green)', marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: 700 },
  sub: { color: 'var(--muted)', fontSize: 14 },
  idBox: {
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
  },
  idLabel: { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 },
  idValue: { fontSize: 20, fontWeight: 700, color: 'var(--blue)', fontFamily: "'Courier New', monospace" },
  btn: {
    background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4, transition: 'opacity 0.2s', fontFamily: 'inherit',
  },
};
