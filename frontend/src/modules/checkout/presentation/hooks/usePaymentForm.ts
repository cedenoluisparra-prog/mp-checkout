import { useState, useEffect, ChangeEvent } from 'react';
import { useMercadoPago } from './useMercadoPago';
import { validatePaymentForm, FormErrors } from '../../application/validation/PaymentFormValidator';
import { buildCreatePaymentDTO } from '../../application/dtos/CreatePaymentDTO';
import { CreatePaymentUseCase } from '../../application/use-cases/CreatePaymentUseCase';
import { MercadoPagoTokenizer } from '../../infrastructure/providers/mercadopago/MercadoPagoTokenizer';
import { PaymentRepository } from '../../infrastructure/repositories/PaymentRepository';
import { Payment } from '../../domain/entities/Payment';
import { logger } from '../../../shared/logging/Logger';
import { appConfig } from '../../../shared/config/AppConfig';
import { mapSdkError } from '../../infrastructure/providers/mercadopago/MercadoPagoErrorMapper';
import { COUNTRY_CONFIG, DEFAULT_COUNTRY } from '../../domain/config/CountryConfig';

interface Field { value: string; error: string }
const field = (v = ''): Field => ({ value: v, error: '' });

type Status = 'idle' | 'loading' | 'success' | 'error';

interface InstallmentOption {
  installments: number;
  recommended_message: string;
}

export interface PaymentFormState {
  amount: Field;
  email: Field;
  number: Field;
  numberFocused: boolean;
  name: Field;
  expMonth: Field;
  expYear: Field;
  cvv: Field;
  country: string;
  docType: string;
  docNum: Field;
  installments: number;
  installmentOptions: InstallmentOption[];
  cardBrand: string;
  flipped: boolean;
  status: Status;
  errorMsg: string;
  payment: Payment | null;
  formKey: number;
}

export interface PaymentFormHandlers {
  handleAmount: (e: ChangeEvent<HTMLInputElement>) => void;
  handleNumber: (e: ChangeEvent<HTMLInputElement>) => void;
  handleNumberFocus: () => void;
  handleNumberBlur: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  setEmail: (f: Field) => void;
  setName: (f: Field) => void;
  setExpMonth: (f: Field) => void;
  setExpYear: (f: Field) => void;
  setCvv: (f: Field) => void;
  setCountry: (code: string) => void;
  setDocType: (v: string) => void;
  setDocNum: (f: Field) => void;
  setInstallments: (v: number) => void;
  setFlipped: (v: boolean) => void;
  reset: () => void;
  ready: boolean;
}

export function usePaymentForm(): [PaymentFormState, PaymentFormHandlers] {
  const { mp, ready } = useMercadoPago();

  const [amount, setAmount] = useState(field());
  const [email, setEmail] = useState(field());
  const [number, setNumber] = useState(field());
  const [numberFocused, setNumberFocused] = useState(false);
  const [name, setName] = useState(field());
  const [expMonth, setExpMonth] = useState(field());
  const [expYear, setExpYear] = useState(field());
  const [cvv, setCvv] = useState(field());
  const [country, setCountryState] = useState(DEFAULT_COUNTRY);
  const [docType, setDocType] = useState(COUNTRY_CONFIG[DEFAULT_COUNTRY].idTypes[0]);

  const setCountry = (code: string) => {
    setCountryState(code);
    setDocType(COUNTRY_CONFIG[code]?.idTypes[0] ?? '');
  };
  const [docNum, setDocNum] = useState(field());
  const [installments, setInstallments] = useState(1);
  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);
  const [cardBrand, setCardBrand] = useState('');
  const [cardPaymentMethodId, setCardPaymentMethodId] = useState('visa');
  const [cardPaymentMethodType, setCardPaymentMethodType] = useState('credit_card');
  const [cardIssuerId, setCardIssuerId] = useState<number | undefined>(undefined);
  const [flipped, setFlipped] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [formKey, setFormKey] = useState(0);

  // BIN detection: call MP SDK when 6+ digits are available
  useEffect(() => {
    const digits = number.value.replace(/\D/g, '');
    if (!mp || !ready || digits.length < 6) {
      if (digits.length < 6) {
        setCardBrand('');
        setCardPaymentMethodId('visa');
        setCardPaymentMethodType('credit_card');
        setCardIssuerId(undefined);
      }
      return;
    }
    let cancelled = false;
    mp.getPaymentMethods({ bin: digits.slice(0, 6) }).then((res) => {
      if (cancelled) return;
      const method = res.results[0];
      if (method) {
        setCardBrand(method.id);
        setCardPaymentMethodId(method.id);
        setCardPaymentMethodType(method.payment_type_id ?? 'credit_card');
        setCardIssuerId(method.issuer?.id);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [number.value, ready]);

  // Installments: fetch from MP when BIN + amount are ready
  useEffect(() => {
    const digits = number.value.replace(/\D/g, '');
    const amountNum = parseFloat(amount.value);
    if (!mp || !ready || digits.length < 6 || isNaN(amountNum) || amountNum < 10) {
      setInstallmentOptions([]);
      return;
    }
    let cancelled = false;
    mp.getInstallments({
      amount: amountNum.toFixed(2),
      bin: digits.slice(0, 6),
      paymentTypeId: cardPaymentMethodType,
    }).then((res) => {
      if (cancelled) return;
      const options = res[0]?.payer_costs ?? [];
      setInstallmentOptions(options);
      if (options.length > 0) setInstallments(options[0].installments);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [number.value, amount.value, cardPaymentMethodType, ready]);

  const handleAmount = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    setAmount({ value: raw, error: '' });
  };

  const handleNumber = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    setNumber({ value: formatted, error: '' });
  };

  const handleNumberFocus = () => setNumberFocused(true);
  const handleNumberBlur = () => setNumberFocused(false);

  const applyErrors = (errors: FormErrors) => {
    if (errors.amount) setAmount(f => ({ ...f, error: errors.amount! }));
    if (errors.payerEmail) setEmail(f => ({ ...f, error: errors.payerEmail! }));
    if (errors.cardNumber) setNumber(f => ({ ...f, error: errors.cardNumber! }));
    if (errors.cardholderName) setName(f => ({ ...f, error: errors.cardholderName! }));
    if (errors.expMonth) setExpMonth(f => ({ ...f, error: errors.expMonth! }));
    if (errors.expYear) setExpYear(f => ({ ...f, error: errors.expYear! }));
    if (errors.cvv) setCvv(f => ({ ...f, error: errors.cvv! }));
    if (errors.identificationNumber) setDocNum(f => ({ ...f, error: errors.identificationNumber! }));
  };

  const reset = () => {
    setAmount(field()); setEmail(field());
    setNumber(field()); setName(field());
    setExpMonth(field()); setExpYear(field()); setCvv(field()); setDocNum(field());
    setCountryState(DEFAULT_COUNTRY);
    setDocType(COUNTRY_CONFIG[DEFAULT_COUNTRY].idTypes[0]);
    setInstallments(1); setInstallmentOptions([]);
    setCardBrand(''); setCardPaymentMethodId('visa'); setCardPaymentMethodType('credit_card');
    setCardIssuerId(undefined);
    setStatus('idle'); setErrorMsg(''); setPayment(null);
    setNumberFocused(false); setFlipped(false);
    setFormKey(k => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;
    if (!mp || !ready) return;

    const { valid, errors } = validatePaymentForm({
      amount: amount.value,
      payerEmail: email.value,
      cardNumber: number.value,
      cardholderName: name.value,
      expMonth: expMonth.value,
      expYear: expYear.value,
      cvv: cvv.value,
      identificationNumber: docNum.value,
    });

    if (!valid) {
      applyErrors(errors);
      // Move focus to first invalid field so screen readers / keyboard users know what failed
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        el?.focus();
      });
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const dto = buildCreatePaymentDTO({
        token: '',
        amount: parseFloat(amount.value),
        payerEmail: email.value,
        payerFirstName: '',
        payerLastName: '',
        country,
        identificationType: docType,
        identificationNumber: docNum.value,
        paymentMethodId: cardPaymentMethodId,
        paymentMethodType: cardPaymentMethodType,
        issuerId: cardIssuerId,
        installments,
      });

      const tokenizer = new MercadoPagoTokenizer(mp);
      const repository = new PaymentRepository(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
      const useCase = new CreatePaymentUseCase(tokenizer, repository, logger);

      const result = await useCase.execute(dto, {
        cardNumber: number.value,
        cardholderName: name.value,
        cardExpirationMonth: expMonth.value,
        cardExpirationYear: expYear.value,
        securityCode: cvv.value,
        identificationType: docType,
        identificationNumber: docNum.value,
      });

      setPayment({ ...result, amount: dto.amount.value, currency: 'MXN' });
      setStatus('success');
    } catch (err) {
      logger.error('payment.form.error', { message: mapSdkError(err) });
      setErrorMsg(mapSdkError(err));
      setStatus('error');
    }
  };

  const state: PaymentFormState = {
    amount, email, number, numberFocused, name, expMonth, expYear, cvv,
    country, docType, docNum, installments, installmentOptions, cardBrand, flipped, status, errorMsg, payment, formKey,
  };

  const handlers: PaymentFormHandlers = {
    handleAmount, handleNumber, handleNumberFocus, handleNumberBlur, handleSubmit,
    setEmail, setName, setExpMonth, setExpYear, setCvv,
    setCountry, setDocType, setDocNum, setInstallments, setFlipped, reset, ready,
  };

  return [state, handlers];
}
