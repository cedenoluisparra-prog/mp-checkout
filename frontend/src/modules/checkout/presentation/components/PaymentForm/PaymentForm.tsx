import { CSSProperties } from 'react';
import { CardPreview } from '../CardPreview/CardPreview';
import { SuccessScreen } from '../SuccessScreen/SuccessScreen';
import { usePaymentForm } from '../../hooks/usePaymentForm';
import { COUNTRY_CONFIG } from '../../../domain/config/CountryConfig';

const FALLBACK_INSTALLMENTS = [1, 3, 6, 9, 12, 18];

export function PaymentForm() {
  const [state, handlers] = usePaymentForm();

  const {
    amount, email, number, numberFocused, name, expMonth, expYear, cvv,
    country, docType, docNum, installments, installmentOptions, cardBrand, flipped, status, errorMsg, payment, formKey,
  } = state;

  const {
    handleAmount, handleNumber, handleNumberFocus, handleNumberBlur, handleSubmit,
    setEmail, setName, setExpMonth, setExpYear, setCvv,
    setCountry, setDocType, setDocNum, setInstallments, setFlipped, reset, ready,
  } = handlers;

  const digits = number.value.replace(/\D/g, '');
  const numberMasked = !numberFocused && digits.length >= 4;

  const displayNumber = numberMasked
    ? `•••• •••• •••• ${digits.slice(-4)}`
    : number.value;

  const displayAmount = amount.value && !isNaN(parseFloat(amount.value))
    ? parseFloat(amount.value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  if (status === 'success' && payment) {
    return <SuccessScreen payment={payment} onReset={reset} />;
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.logo} aria-hidden="true">MP</span>
        <span style={s.headerTitle}>Pago seguro</span>
      </header>

      <div style={s.cardWrap}>
        <CardPreview
          number={number.value}
          numberMasked={numberMasked}
          name={name.value}
          expMonth={expMonth.value}
          expYear={expYear.value}
          flipped={flipped}
          brand={cardBrand}
        />
      </div>

      <form key={formKey} onSubmit={handleSubmit} style={s.form} noValidate aria-label="Formulario de pago">

        <div style={s.group}>
          <label htmlFor="amount" style={s.label}>Monto a pagar (MXN)</label>
          <div style={{ ...s.amountWrap, ...(amount.error ? s.inputErr : {}) }}>
            <span style={s.currency} aria-hidden="true">$</span>
            <input
              id="amount"
              name="transaction-amount"
              style={s.amountInput}
              placeholder="0.00"
              value={amount.value}
              onChange={handleAmount}
              inputMode="decimal"
              autoComplete="off"
              aria-required="true"
              aria-invalid={!!amount.error}
              aria-describedby={amount.error ? 'amount-error' : undefined}
            />
          </div>
          {amount.error && <span id="amount-error" role="alert" style={s.err}>{amount.error}</span>}
        </div>

        <div style={s.group}>
          <label htmlFor="email" style={s.label}>Correo electrónico</label>
          <input
            id="email"
            name="email"
            style={{ ...s.input, ...(email.error ? s.inputErr : {}) }}
            placeholder="tu@correo.com"
            value={email.value}
            onChange={e => setEmail({ value: e.target.value, error: '' })}
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-required="true"
            aria-invalid={!!email.error}
            aria-describedby={email.error ? 'email-error' : undefined}
          />
          {email.error && <span id="email-error" role="alert" style={s.err}>{email.error}</span>}
        </div>

        <div style={s.group}>
          <label htmlFor="card-number" style={s.label}>Número de tarjeta</label>
          <input
            id="card-number"
            name="cardnumber"
            style={{ ...s.input, ...(number.error ? s.inputErr : {}) }}
            placeholder="0000 0000 0000 0000"
            value={displayNumber}
            onChange={handleNumber}
            onFocus={handleNumberFocus}
            onBlur={handleNumberBlur}
            maxLength={19}
            inputMode="numeric"
            autoComplete="cc-number"
            aria-required="true"
            aria-invalid={!!number.error}
            aria-describedby={number.error ? 'card-number-error' : undefined}
          />
          {number.error && <span id="card-number-error" role="alert" style={s.err}>{number.error}</span>}
        </div>

        <div style={s.group}>
          <label htmlFor="cardholder-name" style={s.label}>Nombre del titular</label>
          <input
            id="cardholder-name"
            name="ccname"
            style={{ ...s.input, ...(name.error ? s.inputErr : {}) }}
            placeholder="Como aparece en la tarjeta"
            value={name.value}
            onChange={e => setName({ value: e.target.value.toUpperCase(), error: '' })}
            autoComplete="cc-name"
            aria-required="true"
            aria-invalid={!!name.error}
            aria-describedby={name.error ? 'cardholder-name-error' : undefined}
          />
          {name.error && <span id="cardholder-name-error" role="alert" style={s.err}>{name.error}</span>}
        </div>

        <div style={s.row}>
          <div style={{ ...s.group, flex: 1 }}>
            <label htmlFor="exp-month" style={s.label}>Mes</label>
            <input
              id="exp-month"
              name="cc-exp-month"
              style={{ ...s.input, ...(expMonth.error ? s.inputErr : {}) }}
              placeholder="MM"
              value={expMonth.value}
              onChange={e => setExpMonth({ value: e.target.value.replace(/\D/g, '').slice(0, 2), error: '' })}
              inputMode="numeric"
              maxLength={2}
              autoComplete="cc-exp-month"
              aria-required="true"
              aria-invalid={!!expMonth.error}
              aria-describedby={expMonth.error ? 'exp-month-error' : undefined}
            />
            {expMonth.error && <span id="exp-month-error" role="alert" style={s.err}>{expMonth.error}</span>}
          </div>

          <div style={{ ...s.group, flex: 1 }}>
            <label htmlFor="exp-year" style={s.label}>Año</label>
            <input
              id="exp-year"
              name="cc-exp-year"
              style={{ ...s.input, ...(expYear.error ? s.inputErr : {}) }}
              placeholder="AA"
              value={expYear.value}
              onChange={e => setExpYear({ value: e.target.value.replace(/\D/g, '').slice(0, 2), error: '' })}
              inputMode="numeric"
              maxLength={2}
              autoComplete="cc-exp-year"
              aria-required="true"
              aria-invalid={!!expYear.error}
              aria-describedby={expYear.error ? 'exp-year-error' : undefined}
            />
            {expYear.error && <span id="exp-year-error" role="alert" style={s.err}>{expYear.error}</span>}
          </div>

          <div style={{ ...s.group, flex: 1 }}>
            <label htmlFor="cvv" style={s.label}>CVV</label>
            <input
              id="cvv"
              style={{ ...s.input, ...(cvv.error ? s.inputErr : {}) }}
              placeholder="•••"
              value={cvv.value}
              type="password"
              onChange={e => setCvv({ value: e.target.value.replace(/\D/g, '').slice(0, 4), error: '' })}
              onFocus={() => setFlipped(true)}
              onBlur={() => setFlipped(false)}
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              aria-required="true"
              aria-invalid={!!cvv.error}
              aria-describedby={cvv.error ? 'cvv-error' : undefined}
              aria-label="Código de seguridad CVV"
            />
            {cvv.error && <span id="cvv-error" role="alert" style={s.err}>{cvv.error}</span>}
          </div>
        </div>

        <div style={s.group}>
          <label htmlFor="installments" style={s.label}>Meses</label>
          <select
            id="installments"
            style={{ ...s.input, ...s.select }}
            value={installments}
            onChange={e => setInstallments(Number(e.target.value))}
            aria-label="Número de meses"
          >
            {installmentOptions.length > 0
              ? installmentOptions.map(opt => (
                  <option key={opt.installments} value={opt.installments}>
                    {opt.recommended_message}
                  </option>
                ))
              : FALLBACK_INSTALLMENTS.map(n => (
                  <option key={n} value={n}>
                    {n === 1 ? '1 mes (contado)' : `${n} meses`}
                  </option>
                ))
            }
          </select>
        </div>

        <div style={s.group}>
          <label htmlFor="country" style={s.label}>País</label>
          <select
            id="country"
            style={{ ...s.input, ...s.select }}
            value={country}
            onChange={e => setCountry(e.target.value)}
            aria-label="País"
          >
            {Object.entries(COUNTRY_CONFIG).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        <div style={s.group}>
          <label htmlFor="doc-num" style={s.label}>Documento de identidad</label>
          <div style={s.row}>
            <select
              id="doc-type"
              style={{ ...s.input, ...s.select, width: 90, flexShrink: 0 }}
              value={docType}
              onChange={e => setDocType(e.target.value)}
              aria-label="Tipo de documento de identidad"
            >
              {COUNTRY_CONFIG[country]?.idTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              id="doc-num"
              style={{ ...s.input, ...(docNum.error ? s.inputErr : {}), flex: 1 }}
              placeholder="Número de documento"
              value={docNum.value}
              onChange={e => setDocNum({ value: e.target.value.toUpperCase(), error: '' })}
              aria-required="true"
              aria-invalid={!!docNum.error}
              aria-describedby={docNum.error ? 'doc-num-error' : undefined}
            />
          </div>
          {docNum.error && <span id="doc-num-error" role="alert" style={s.err}>{docNum.error}</span>}
        </div>

        {status === 'error' && (
          <div role="alert" style={s.errorBanner}>
            <span style={s.errorIcon} aria-hidden="true">⚠</span>
            {errorMsg || 'Ocurrió un error. Verifica tus datos e intenta de nuevo.'}
          </div>
        )}

        <button
          type="submit"
          style={{ ...s.btn, ...(status === 'loading' ? s.btnLoading : {}) }}
          disabled={status === 'loading' || !ready}
          aria-busy={status === 'loading'}
        >
          {status === 'loading' ? <Spinner /> : `Pagar MXN $${displayAmount}`}
        </button>

        <p style={s.secure}>
          <span style={s.lockIcon} aria-hidden="true">🔒</span>
          Transacción cifrada · Powered by Mercado Pago
        </p>
      </form>
    </div>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Procesando pago"
      style={{
        display: 'inline-block', width: 18, height: 18,
        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 40px', background: 'var(--bg)' },
  header: { width: '100%', maxWidth: 400, display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0 32px' },
  logo: { fontSize: 22, fontWeight: 900, color: '#009ee3', letterSpacing: -1 },
  headerTitle: { fontSize: 15, color: 'var(--muted)', flex: 1 },
  cardWrap: { marginBottom: 32, width: '100%', maxWidth: 400 },
  form: { width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: 'var(--muted)', letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500 },
  amountWrap: { display: 'flex', alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' },
  currency: { padding: '0 14px', fontSize: 20, fontWeight: 700, color: 'var(--muted)', userSelect: 'none' as const },
  amountInput: { flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 24, fontWeight: 700, padding: '12px 14px 12px 0', outline: 'none', fontFamily: 'inherit', width: '100%' },
  input: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, padding: '12px 14px', outline: 'none', transition: 'border-color 0.2s', width: '100%', fontFamily: 'inherit' },
  inputErr: { borderColor: 'var(--red)' },
  select: { cursor: 'pointer', appearance: 'none' },
  row: { display: 'flex', gap: 10 },
  err: { fontSize: 11, color: 'var(--red)', marginTop: 2 },
  errorBanner: { background: 'rgba(255,79,94,0.1)', border: '1px solid rgba(255,79,94,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 10 },
  errorIcon: { fontSize: 16 },
  btn: { background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, transition: 'opacity 0.2s', fontFamily: 'inherit' },
  btnLoading: { opacity: 0.7, cursor: 'not-allowed' },
  secure: { textAlign: 'center' as const, fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lockIcon: { fontSize: 13 },
};
