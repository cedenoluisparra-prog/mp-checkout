import { CSSProperties } from 'react';

interface Props {
  number: string;
  numberMasked: boolean;
  name: string;
  expMonth: string;
  expYear: string;
  flipped: boolean;
  brand?: string;
}

const fmt = (n: string, masked: boolean) => {
  const raw = n.replace(/\D/g, '').slice(0, 16);
  if (masked && raw.length >= 4) {
    return `•••• •••• •••• ${raw.slice(-4)}`;
  }
  return raw.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim();
};

function BrandLogo({ brand }: { brand: string }) {
  switch (brand) {
    case 'visa':
      return (
        <svg width="58" height="20" viewBox="0 0 58 20" aria-label="Visa">
          <text
            x="1" y="17"
            fontSize="22" fontWeight="900" fontStyle="italic"
            fontFamily="Arial, sans-serif"
            fill="#fff"
            letterSpacing="-1"
          >
            VISA
          </text>
        </svg>
      );

    case 'master':
    case 'mastercard':
    case 'debmaster':
      return (
        <svg width="46" height="30" viewBox="0 0 46 30" aria-label="Mastercard">
          <circle cx="16" cy="15" r="14" fill="#EB001B" />
          <circle cx="30" cy="15" r="14" fill="#F79E1B" />
          {/* overlap region rendered as a narrower shape in between */}
          <path
            d="M23,3.4 C26.3,5.9 28.5,9.7 28.5,15 C28.5,20.3 26.3,24.1 23,26.6 C19.7,24.1 17.5,20.3 17.5,15 C17.5,9.7 19.7,5.9 23,3.4 Z"
            fill="#FF5F00"
          />
        </svg>
      );

    case 'amex':
    case 'american_express':
      return (
        <svg width="58" height="22" viewBox="0 0 58 22" aria-label="American Express">
          <rect x="0" y="0" width="56" height="20" rx="3" fill="rgba(255,255,255,0.15)" />
          <text
            x="4" y="15"
            fontSize="12" fontWeight="700"
            fontFamily="Arial, sans-serif"
            fill="#fff"
            letterSpacing="1"
          >
            AMEX
          </text>
        </svg>
      );

    case 'discover':
      return (
        <svg width="76" height="22" viewBox="0 0 76 22" aria-label="Discover">
          <text
            x="0" y="16"
            fontSize="13" fontWeight="700"
            fontFamily="Arial, sans-serif"
            fill="#fff"
            letterSpacing="0.5"
          >
            DISCOVER
          </text>
          <circle cx="70" cy="11" r="9" fill="#F76F20" />
        </svg>
      );

    default:
      return null;
  }
}

export function CardPreview({ number, numberMasked, name, expMonth, expYear, flipped, brand = '' }: Props) {
  return (
    <div style={styles.scene}>
      <div style={{ ...styles.card, ...(flipped ? styles.cardFlipped : {}) }}>
        <div style={styles.front}>
          <div style={styles.glare} />
          <div style={styles.topRow}>
            <div style={styles.chip}>
              <div style={styles.chipLine} />
              <div style={styles.chipLine} />
            </div>
            {brand && (
              <div style={styles.brandWrap}>
                <BrandLogo brand={brand} />
              </div>
            )}
          </div>
          <div style={styles.number}>{fmt(number, numberMasked)}</div>
          <div style={styles.meta}>
            <div>
              <div style={styles.label}>Titular</div>
              <div style={styles.value}>{name || 'NOMBRE APELLIDO'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={styles.label}>Vence</div>
              <div style={styles.value}>
                {(expMonth || 'MM').padStart(2, '0')}/{(expYear || 'AA').slice(-2)}
              </div>
            </div>
          </div>
          <div style={styles.mpLogo}>MP</div>
        </div>

        <div style={styles.back}>
          <div style={styles.stripe} />
          <div style={styles.cvvRow}>
            <span style={styles.cvvLabel}>CVV</span>
            <div style={styles.cvvBox}>•••</div>
          </div>
          <div style={styles.mpLogoBack}>MP</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  scene: { perspective: 1000, width: 340, height: 200, margin: '0 auto' },
  card: {
    width: '100%', height: '100%', position: 'relative',
    transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
  },
  cardFlipped: { transform: 'rotateY(180deg)' },
  front: {
    position: 'absolute', inset: 0, borderRadius: 16,
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    padding: '24px 28px', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
  },
  back: {
    position: 'absolute', inset: 0, borderRadius: 16,
    background: 'linear-gradient(135deg, #0f3460 0%, #16213e 60%, #1a1a2e 100%)',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
  },
  glare: {
    position: 'absolute', top: -60, right: -60, width: 200, height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,158,227,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    width: 44, height: 34,
    background: 'linear-gradient(135deg, #d4af37 0%, #f0d060 50%, #b8952a 100%)',
    borderRadius: 6, display: 'flex', flexDirection: 'column',
    justifyContent: 'center', gap: 6, padding: '0 8px',
  },
  chipLine: { height: 1, background: 'rgba(0,0,0,0.3)', borderRadius: 1 },
  brandWrap: { display: 'flex', alignItems: 'center' },
  number: {
    fontFamily: "'Courier New', monospace", fontSize: 20, letterSpacing: 3,
    color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },
  meta: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: {
    fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', marginBottom: 2,
  },
  value: {
    fontSize: 13, color: '#fff', fontWeight: 500, letterSpacing: 0.5,
    textTransform: 'uppercase', maxWidth: 140, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  mpLogo: { position: 'absolute', bottom: 20, right: 24, fontSize: 18, fontWeight: 900, color: '#009ee3', letterSpacing: -1 },
  stripe: { height: 44, background: '#111', width: '100%' },
  cvvRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 28px' },
  cvvLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase' },
  cvvBox: {
    flex: 1, background: '#fff', color: '#000', textAlign: 'right',
    padding: '6px 12px', borderRadius: 4, fontSize: 14, letterSpacing: 4,
    fontFamily: "'Courier New', monospace",
  },
  mpLogoBack: { position: 'absolute', bottom: 20, right: 24, fontSize: 18, fontWeight: 900, color: '#009ee3', letterSpacing: -1 },
};
