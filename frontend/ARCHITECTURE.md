# mp-checkout — Documentación técnica completa

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura](#3-arquitectura)
4. [Base de datos](#4-base-de-datos)
5. [Backend — Supabase Edge Functions](#5-backend--supabase-edge-functions)
6. [Frontend — React modules](#6-frontend--react-modules)
7. [Seguridad](#7-seguridad)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Flujos principales](#9-flujos-principales)
10. [Tests](#10-tests)
11. [Despliegue](#11-despliegue)
12. [Decisiones técnicas](#12-decisiones-técnicas)

---

## 1. Visión general

Integración de pagos con Mercado Pago para México. El usuario ingresa datos de tarjeta en el browser, el SDK de MP los tokeniza directamente en sus servidores (PCI DSS), y el token se envía a un Edge Function que ejecuta el cobro vía la Orders API v1.

```
Browser → MP SDK (tokeniza) → Supabase Edge Function → Mercado Pago Orders API
                                       ↓
                               Supabase Postgres
                                       ↑
                               MP Webhook (actualiza estado)
```

Los datos de tarjeta **nunca** llegan al servidor propio. Solo viajan: token (efímero), email del pagador, monto, método de pago e issuer ID.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript 5.9 + Vite 5 |
| Backend | Supabase Edge Functions (Deno 2.x) |
| Base de datos | Supabase Postgres (PostgreSQL 15) |
| Pasarela de pago | Mercado Pago Orders API v1 |
| Tokenización | Mercado Pago JS SDK v2 (`window.MercadoPago`) |
| Rate limiting | Deno KV (sliding window por IP) |
| Tests frontend | Vitest 4 + Testing Library |
| Tests backend | Deno test runner nativo |
| CI/CD | GitHub Actions (`.github/workflows/ci.yml`) |
| Hosting frontend | Vercel (auto-deploy desde GitHub `main`) |
| Hosting backend | Supabase (proyecto `nvrhzqmnxdzkffnpjqkf`) |

---

## 3. Arquitectura

El proyecto sigue **Clean Architecture** en ambas capas. La regla de dependencia se respeta estrictamente: las capas internas no conocen las externas.

```
Domain → Application → Infrastructure → Presentation
  ↑           ↑               ↑               ↑
(entidades) (casos de uso) (adapters)    (controllers/UI)
```

### 3.1 Árbol de directorios

```
mp-checkout/
├── .github/workflows/ci.yml             — CI: frontend tests + backend Deno tests
├── supabase/
│   ├── migrations/
│   │   ├── 20260516000000_create_payments.sql   — tabla payments + índices + RLS + trigger
│   │   ├── 20260516000001_rls_policies.sql      — política deny_direct_access
│   │   └── 20260516000002_immutability_constraints.sql — CHECK constraints + trigger inmutabilidad
│   └── functions/
│       ├── _shared/
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   │   ├── Payment.ts
│       │   │   │   └── WebhookEvent.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── Money.ts                 — min $10, max $999,999 MXN
│       │   │   │   ├── Email.ts
│       │   │   │   └── PaymentStatus.ts         — enum + isValidTransition (state machine)
│       │   │   ├── errors/
│       │   │   │   ├── DomainError.ts
│       │   │   │   ├── PaymentError.ts
│       │   │   │   └── ValidationError.ts
│       │   │   └── interfaces/
│       │   │       ├── IPaymentGateway.ts       — incluye PaymentItem interface
│       │   │       ├── IPaymentRepository.ts
│       │   │       └── ILogger.ts
│       │   ├── application/
│       │   │   ├── use-cases/
│       │   │   │   ├── CreatePaymentUseCase.ts  — envía items[] + issuerId al gateway
│       │   │   │   └── ProcessWebhookUseCase.ts — state machine + idempotencia + DB update
│       │   │   └── dtos/
│       │   │       ├── CreatePaymentDTO.ts      — valida token, Money, Email, issuerId, items
│       │   │       └── WebhookEventDTO.ts
│       │   ├── infrastructure/
│       │   │   ├── config/AppConfig.ts          — falla si falta cualquier env var
│       │   │   ├── gateways/mercadopago/
│       │   │   │   ├── MercadoPagoGateway.ts    — envía items[] + issuer_id a Orders API
│       │   │   │   └── MercadoPagoErrorMapper.ts
│       │   │   ├── repositories/
│       │   │   │   └── SupabasePaymentRepository.ts
│       │   │   ├── http/
│       │   │   │   ├── HttpResponseBuilder.ts   — security headers en todas las respuestas
│       │   │   │   └── WebhookSignatureValidator.ts — HMAC-SHA256 + anti-replay ±5 min
│       │   │   └── logging/
│       │   │       └── StructuredLogger.ts      — JSON con correlationId por request
│       │   └── presentation/
│       │       ├── CorsMiddleware.ts
│       │       └── ErrorHandler.ts
│       ├── create-payment/
│       │   └── index.ts    — rate limiting Deno KV 10 req/min + controller
│       └── mp-webhook/
│           └── index.ts    — rate limiting Deno KV 100 req/min + controller
│
└── frontend/
    ├── vercel.json           — SPA rewrite + CSP, HSTS, X-Frame-Options, Permissions-Policy
    ├── public/robots.txt     — Disallow: / (página de pago no se indexa)
    └── src/
        ├── modules/
        │   ├── shared/
        │   │   ├── config/AppConfig.ts
        │   │   ├── errors/AppError.ts
        │   │   └── logging/Logger.ts             — noop en producción
        │   └── checkout/
        │       ├── domain/
        │       │   ├── entities/Payment.ts
        │       │   ├── value-objects/
        │       │   │   ├── Money.ts
        │       │   │   ├── Email.ts
        │       │   │   └── CardNumber.ts          — Luhn + longitud 13–19
        │       │   └── interfaces/
        │       │       ├── ITokenizer.ts
        │       │       └── IPaymentService.ts     — incluye itemTitle, itemDescription
        │       ├── application/
        │       │   ├── use-cases/CreatePaymentUseCase.ts
        │       │   ├── dtos/CreatePaymentDTO.ts   — incluye issuerId, itemTitle, itemDescription
        │       │   └── validation/
        │       │       └── PaymentFormValidator.ts — Luhn + expiración combinada año+mes
        │       ├── infrastructure/
        │       │   ├── providers/mercadopago/
        │       │   │   ├── MercadoPagoTokenizer.ts
        │       │   │   └── MercadoPagoErrorMapper.ts
        │       │   └── repositories/
        │       │       └── PaymentRepository.ts   — envía issuerId, itemTitle, itemDescription
        │       └── presentation/
        │           ├── hooks/
        │           │   ├── useMercadoPago.ts
        │           │   └── usePaymentForm.ts      — BIN detection, installments dinámicos, issuerId
        │           └── components/
        │               ├── PaymentForm/PaymentForm.tsx  — ARIA completo, concepto de pago
        │               ├── CardPreview/CardPreview.tsx  — logos de marca SVG inline
        │               ├── SuccessScreen/SuccessScreen.tsx
        │               └── ErrorBoundary/ErrorBoundary.tsx — clase React, catch + retry
        ├── types/mercadopago.d.ts  — PayerCost, getInstallments con paymentTypeId, getIssuers
        ├── App.tsx                 — envuelve PaymentForm en ErrorBoundary
        └── test-setup.ts
```

---

## 4. Base de datos

### 4.1 Tabla `payments`

```sql
CREATE TABLE payments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           TEXT        UNIQUE,         -- ID de orden MP (alfanumérico PAY01...)
  payment_id         TEXT,
  external_reference UUID        NOT NULL,       -- UUID generado en el servidor
  amount             NUMERIC(12,2) NOT NULL,
  currency           TEXT        NOT NULL DEFAULT 'MXN',
  status             TEXT        NOT NULL DEFAULT 'pending',
  status_detail      TEXT,
  payer_email        TEXT,
  payment_method_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Índices

```sql
idx_payments_order_id           ON payments(order_id)
idx_payments_external_reference ON payments(external_reference)
idx_payments_status             ON payments(status)
```

### 4.3 Constraints de inmutabilidad (migration 000002)

```sql
-- CHECK a nivel DB
CONSTRAINT chk_payments_status CHECK (status IN ('pending','processed','failed','refunded'))
CONSTRAINT chk_payments_currency CHECK (currency IN ('MXN','USD','ARS','BRL','COP','CLP','PEN'))
CONSTRAINT chk_payments_amount CHECK (amount > 0)

-- Trigger BEFORE UPDATE — bloquea mutación de campos inmutables
prevent_immutable_fields_mutation() → bloquea amount, external_reference, order_id, payer_email
```

### 4.4 Row Level Security

RLS habilitado con política `DENY ALL` para roles `anon` y `authenticated`. Solo `service_role` (Edge Functions) puede leer y escribir.

### 4.5 Trigger `updated_at`

Cada `UPDATE` actualiza automáticamente `updated_at = NOW()`.

---

## 5. Backend — Supabase Edge Functions

### 5.1 `create-payment`

**Ruta**: `POST /functions/v1/create-payment`  
**CORS**: Solo `ALLOWED_ORIGIN`  
**Rate limiting**: Deno KV — 10 req/min por IP → HTTP 429 + `Retry-After: 60`

**Flujo**:
```
1. Preflight OPTIONS
2. Verifica method POST (405 si no)
3. Rate limit por IP (429 si excedido)
4. Verifica Content-Type: application/json (400 si no)
5. CreatePaymentDTO.fromRequest(body) — valida token, Money, Email, installments, issuerId, items
6. MercadoPagoGateway.createPayment(dto) → POST /v1/orders con X-Idempotency-Key
7. SupabasePaymentRepository.save(payment) → INSERT payments
8. Retorna { orderId, paymentId, status, statusDetail }
```

**Respuestas**: `200` éxito, `400` validación, `422` rechazado por MP, `429` rate limit, `500` error interno.

### 5.2 `mp-webhook`

**Ruta**: `POST /functions/v1/mp-webhook`  
**Auth**: Sin JWT, validación HMAC obligatoria  
**Rate limiting**: Deno KV — 100 req/min por IP → ack 200 (no 429, para evitar tormenta de retries de MP)

**Flujo completo**:
```
1.  Preflight OPTIONS
2.  Rate limit (si excedido: ack 200 silencioso)
3.  Verifica presencia de x-signature → 401 si ausente
4.  WebhookEventDTO.fromRequest() — valida type y resourceId
5.  Tipo no soportado → ack 200 silencioso
6.  WebhookSignatureValidator.validate() — HMAC-SHA256 + anti-replay ±5 min → 401 si falla
7.  MercadoPagoGateway.fetchPayment(resourceId) — re-fetcha estado real desde MP
8.  repository.findByOrderId() — orden no existe en DB: warn + ack
9.  Status ya igual al existente: info + ack (idempotencia)
10. isValidTransition(existing.status, newStatus) — transición inválida: warn + ack
11. repository.updateStatus() → UPDATE payments SET status, status_detail
12. Siempre retorna 200 { received: true }
```

**State machine**:
```
pending → processed | failed
processed → refunded
failed → (terminal)
refunded → (terminal)
```

### 5.3 Módulos compartidos (`_shared`)

#### Domain layer

**`PaymentStatus`** — Enum + `isValidTransition(from, to)` con `Map<PaymentStatus, Set<PaymentStatus>>`. Estados `Failed` y `Refunded` no tienen transiciones permitidas (terminales).

**`Money`** — `of(amount)` lanza `ValidationError` si < 10, > 999,999, NaN o Infinity. `toFixed()` → string con 2 decimales.

**`Email`** — Normaliza a lowercase, valida regex. Lanza `ValidationError` si inválido.

**`IPaymentGateway`** — Incluye interface `PaymentItem { id, title, description?, categoryId, quantity, unitPrice }` y `CreatePaymentParams` con `items: PaymentItem[]` e `issuerId?: number`.

#### Application layer

**`CreatePaymentDTO.fromRequest(body)`**:
- `token`: string no vacío
- `amount`: `Money.of(parseFloat(...))` — min $10, max $999,999
- `payerEmail`: `Email.of(...)` — formato válido
- `paymentMethodType`: allowlist de tipos conocidos de MP
- `installments`: entre 1 y 48
- `issuerId`: number opcional (del BIN detection del frontend)
- `itemTitle`: string opcional (default `'Pago'` si vacío o ausente)
- `itemDescription`: string opcional
- `externalReference`: generado con `crypto.randomUUID()` — nunca acepta valor del cliente

**`CreatePaymentUseCase`**:
1. `gateway.createPayment(dto)` — construye `items[{ id: externalRef, title, description, categoryId: 'services', quantity: 1, unitPrice }]` e `issuerId` condicional
2. `repository.save(payment)` — persiste en DB
3. `logger.info('payment.created', { orderId, status })`

**`ProcessWebhookUseCase`**:
1. `gateway.fetchPayment(resourceId)` — estado real de MP
2. `repository.findByOrderId()` — verifica existencia; si no existe, warn + return
3. Idempotencia: `existing.status === newStatus` → info + return
4. `isValidTransition(existing, new)` → transición inválida: warn + return
5. `repository.updateStatus()` — actualiza status y status_detail en DB

#### Infrastructure layer

**`MercadoPagoGateway.createPayment()`** — POST a `/v1/orders`:
```json
{
  "type": "online",
  "processing_mode": "automatic",
  "external_reference": "<uuid>",
  "total_amount": "100.00",
  "payer": { "email": "..." },
  "items": [{ "id": "<uuid>", "title": "Pago", "category_id": "services", "quantity": 1, "unit_price": "100.00" }],
  "transactions": {
    "payments": [{
      "amount": "100.00",
      "payment_method": { "id": "visa", "type": "credit_card", "token": "...", "installments": 1, "issuer_id": 1234 }
    }]
  }
}
```
`issuer_id` es condicional (`...(params.issuerId ? { issuer_id: params.issuerId } : {})`).

**`WebhookSignatureValidator.validate()`**:
1. Parsea `ts=` y `v1=` del header `x-signature`
2. Anti-replay: rechaza si `|now - ts| > 300 000ms` (±5 minutos)
3. Construye mensaje: `id:{dataId};request-id:{xRequestId};ts:{ts};`
4. Computa HMAC-SHA256 con `crypto.subtle` (Web Crypto nativa de Deno)
5. Compara con `v1` usando `constantTimeEqual()` — XOR bit a bit, previene timing attacks

**`HttpResponseBuilder`** — Security headers en todas las respuestas del backend:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: payment=()
```

**`AppConfig.fromEnv()`** — Falla en startup si falta `MP_ACCESS_TOKEN`, `ALLOWED_ORIGIN` o `MP_WEBHOOK_SECRET`.

**`StructuredLogger`**:
```json
{ "correlationId": "uuid", "timestamp": "ISO-8601", "level": "info|warn|error", "event": "payment.created", "data": {} }
```

---

## 6. Frontend — React modules

### 6.1 Módulo `shared`

**`AppConfig`** — Lee `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MP_PUBLIC_KEY`. Lanza en carga de módulo si alguno falta.

**`Logger`** — Noop en producción (`import.meta.env.DEV === false`). Sin datos sensibles en DevTools en producción.

### 6.2 Módulo `checkout/domain`

**`CardNumber`** — `of(input)`: extrae dígitos, valida longitud (13–19) y Luhn. Propiedad `bin` → primeros 6 dígitos para BIN detection.

**`Money`**, **`Email`** — Idéntica lógica al backend.

### 6.3 Módulo `checkout/application`

**`PaymentFormValidator.validatePaymentForm(fields)`**:
- Usa `CardNumber.of()` → Luhn + longitud (no solo longitud)
- Expiración combinada: `year === currentYear && month < currentMonth` → "Tarjeta vencida"
- Retorna `{ valid, errors }` — todos los errores en una sola pasada

**`CreatePaymentUseCase.execute(dto, card)`**:
1. `tokenizer.createToken(card)` → token efímero de MP SDK
2. `paymentService.process({ token, amount, payerEmail, issuerId, itemTitle, itemDescription, ... })`
3. Retorna `Payment`

### 6.4 Módulo `checkout/infrastructure`

**`MercadoPagoTokenizer`** — `window.MercadoPago`. Errores del SDK mapeados a español.

**`PaymentRepository`** — Envía al Edge Function: `{ token, amount, payerEmail, paymentMethodId, paymentMethodType, issuerId, installments, itemTitle, itemDescription }`.

### 6.5 Módulo `checkout/presentation`

**`useMercadoPago`** — Polling cada 100ms hasta que `window.MercadoPago` esté disponible. Retorna `{ mp, ready }`.

**`usePaymentForm`** — Hook central:

- **Estado**: `amount`, `email`, `description` (concepto), `number`, `name`, `expMonth`, `expYear`, `cvv`, `docType`, `docNum`, `installments`, `installmentOptions`, `cardBrand`, `cardPaymentMethodId`, `cardPaymentMethodType`, `cardIssuerId`

- **BIN detection** (`useEffect` sobre `number.value + ready`): 6+ dígitos → `mp.getPaymentMethods({ bin })`. Actualiza `cardBrand` (logo), `cardPaymentMethodId`, `cardPaymentMethodType`, `cardIssuerId` (`method.issuer?.id`). Patrón de cancelación con `let cancelled = false`.

- **Installments dinámicos** (`useEffect` sobre `number.value + amount.value + cardPaymentMethodType + ready`): 6+ dígitos y monto ≥ $10 → `mp.getInstallments({ amount, bin, paymentTypeId })`. Almacena `payer_costs[]` en `installmentOptions`, resetea `installments` al primer valor. Patrón de cancelación.

- **Double-submit guard**: `if (status === 'loading') return;` al inicio de `handleSubmit`.

- **Focus management**: tras validación fallida, `requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus())`.

**`PaymentForm`** — UI pura. ARIA completo:
- `htmlFor`/`id` en todos los labels/inputs
- `aria-required`, `aria-invalid={!!field.error}`, `aria-describedby` → `<span id="X-error" role="alert">`
- `aria-busy` en botón durante loading
- `name` para autocomplete: `transaction-amount`, `email`, `cardnumber`, `ccname`, `cc-exp-month`, `cc-exp-year` (CVV sin `name`)
- Concepto de pago: `<input>` opcional, sin validación, pasa como `itemTitle`/`itemDescription`
- Installments: muestra `recommended_message` de MP si `installmentOptions.length > 0`; fallback a `[1,3,6,9,12,18]`

**`CardPreview`** — Preview 3D con logos SVG inline por marca detectada vía BIN:
- `visa` → "VISA" cursiva
- `master`/`mastercard`/`debmaster` → dos círculos solapados (rojo + naranja)
- `amex`/`american_express` → "AMEX" en caja
- `discover` → "DISCOVER" con círculo naranja

**`ErrorBoundary`** — Clase React con `componentDidCatch`. Botón "Reintentar" → `setState({ hasError: false })`. Envuelve `<PaymentForm>` en `App.tsx`.

---

## 7. Seguridad

### 7.1 PCI DSS

Los datos de tarjeta (número, CVV, fecha, nombre) son procesados **exclusivamente** por el SDK de MP en el navegador. Solo viaja el token efímero de un solo uso.

### 7.2 Secretos

| Variable | Exposición | Notas |
|---|---|---|
| `MP_ACCESS_TOKEN` | Solo Edge Functions | Secret de Supabase |
| `MP_WEBHOOK_SECRET` | Solo Edge Functions | Secret de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Edge Functions | Bypasea RLS — nunca en frontend |
| `VITE_MP_PUBLIC_KEY` | Frontend (público) | Por diseño |
| `VITE_SUPABASE_ANON_KEY` | Frontend (público) | Por diseño — seguridad vía RLS |
| `VITE_SUPABASE_URL` | Frontend (público) | Por diseño |

### 7.3 Rate limiting (Deno KV)

| Función | Límite | Respuesta si excedido |
|---|---|---|
| `create-payment` | 10 req/min por IP | HTTP 429 + `Retry-After: 60` |
| `mp-webhook` | 100 req/min por IP | HTTP 200 ack (no dispara retries de MP) |

Implementado con sliding window: timestamps del último minuto por IP almacenados en Deno KV con TTL automático.

### 7.4 Validación de webhook HMAC-SHA256

- `MP_WEBHOOK_SECRET` **obligatorio** — el proceso falla al startup si falta
- Todo request sin `x-signature` → 401
- Anti-replay: timestamp fuera de ±5 min → 401
- Comparación en tiempo constante (XOR bit a bit)
- El payload no se usa; siempre se re-fetcha el estado real desde MP API

### 7.5 Payment state machine

`isValidTransition(from, to)` en `PaymentStatus.ts`:
- `pending → processed | failed`
- `processed → refunded`
- `failed`, `refunded` son terminales

### 7.6 Idempotencia de webhook

Si `existing.status === newStatus`, el UPDATE se omite. MP garantiza at-least-once delivery.

### 7.7 Verificación de orden existente

El webhook verifica que el `orderId` exista en DB antes de actualizar. Evita que un atacante con HMAC válido afecte registros externos.

### 7.8 CORS estricto

`ALLOWED_ORIGIN` requerido, sin fallback a `*`.

### 7.9 RLS + constraints de DB

Política `DENY ALL` para `anon`/`authenticated`. CHECK constraints y trigger de inmutabilidad evitan corrupción incluso con bugs en Edge Functions.

### 7.10 Startup validation

`AppConfig.fromEnv()` valida todos los env vars al inicio. Falla antes de servir cualquier request.

### 7.11 Security headers HTTP (frontend — `vercel.json`)

| Header | Valor |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `payment=(), camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | `script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com; connect-src 'self' https://*.supabase.co https://api.mercadopago.com; frame-ancestors 'none'; object-src 'none'` |

### 7.12 Seguridad visual (frontend)

- Número de tarjeta: `•••• •••• •••• XXXX` al perder foco
- CVV: siempre `type="password"`, preview siempre `•••`
- Logger noop en producción
- `formKey` fuerza remount del `<form>` en reset — limpia autocompletado del navegador
- `robots.txt` con `Disallow: /` — no indexable por buscadores

---

## 8. Variables de entorno

### 8.1 Backend (Supabase Secrets)

```bash
supabase secrets set KEY=value
```

| Variable | Descripción | Requerida |
|---|---|---|
| `MP_ACCESS_TOKEN` | Token de acceso de MP | Sí |
| `MP_WEBHOOK_SECRET` | Secret HMAC para webhooks | Sí |
| `ALLOWED_ORIGIN` | Origen CORS (ej: `https://mp-checkout-eight.vercel.app`) | Sí |
| `SUPABASE_URL` | Auto-inyectada por Supabase | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectada por Supabase | Sí |

### 8.2 Frontend (Vercel / `.env.local`)

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase |
| `VITE_MP_PUBLIC_KEY` | Public key de Mercado Pago |

---

## 9. Flujos principales

### 9.1 Pago exitoso

```
1. Usuario llena el formulario
2. BIN detection (6+ dígitos): mp.getPaymentMethods({ bin })
   → cardBrand (logo), cardPaymentMethodId, cardPaymentMethodType, cardIssuerId
3. Installments dinámicos: mp.getInstallments({ amount, bin, paymentTypeId })
   → payer_costs[] con recommended_message ("3 meses de $33.33")
4. PaymentFormValidator.validatePaymentForm() — Luhn + expiración combinada
5. MercadoPagoTokenizer.createToken(card) — tokeniza en servidores de MP
6. PaymentRepository.process() → POST /functions/v1/create-payment
   ├── CreatePaymentDTO.fromRequest() — validación server-side
   ├── MercadoPagoGateway.createPayment() → POST /v1/orders
   │   Body: type, processing_mode, external_reference, total_amount,
   │         payer.email, items[], transactions.payments[].payment_method + issuer_id
   ├── SupabasePaymentRepository.save() → INSERT payments
   └── { orderId, paymentId, status: 'processed', statusDetail: 'accredited' }
7. SuccessScreen muestra orderId y monto
```

### 9.2 Pago rechazado

```
1–5. Igual que el flujo exitoso
6. MercadoPagoGateway → MP retorna status: 'failed'
   → MercadoPagoErrorMapper → "Fondos insuficientes" / "Tarjeta bloqueada" / etc.
7. ErrorHandler → HTTP 422 { message: "..." }
8. usePaymentForm → setErrorMsg() → banner de error en pantalla
```

### 9.3 Webhook de actualización de estado

```
1.  MP envía POST /functions/v1/mp-webhook (x-signature, x-request-id)
2.  Rate limit (100/min) — si excedido: ack 200
3.  Sin x-signature → 401
4.  WebhookEventDTO — valida type/resourceId; tipo ignorado → ack 200
5.  WebhookSignatureValidator — HMAC + anti-replay ±5 min → 401 si falla
6.  MercadoPagoGateway.fetchPayment(resourceId) — estado real de MP
7.  repository.findByOrderId() — no existe en DB: warn + ack
8.  Status ya igual: info + ack (idempotencia)
9.  isValidTransition(existing, new) — inválida: warn + ack
10. repository.updateStatus() → UPDATE payments SET status, status_detail
11. Retorna 200 { received: true }
```

---

## 10. Tests

### 10.1 Backend (Deno test runner)

```bash
deno test supabase/functions/_shared --allow-all
```

| Archivo | Descripción |
|---|---|
| `domain/value-objects/Money.test.ts` | min, max, NaN, Infinity, fromString, equals |
| `domain/value-objects/Email.test.ts` | válido, inválido, sin dominio, vacío |
| `application/dtos/CreatePaymentDTO.test.ts` | token vacío, amount<10, >999999, email inválido, paymentMethodType inválido, installments=0, boundary=48 |
| `application/use-cases/CreatePaymentUseCase.test.ts` | mock gateway + repository, verifica persistencia |
| `application/use-cases/ProcessWebhookUseCase.test.ts` | orden no encontrada, idempotencia, transición inválida (failed→processed), flujo exitoso |
| `infrastructure/http/WebhookSignatureValidator.test.ts` | firma válida, timestamp expirado, HMAC incorrecto, header malformado, timestamp no numérico |

### 10.2 Frontend (Vitest)

```bash
cd frontend && npm test -- --run
```

| Archivo | Casos | Total |
|---|---|---|
| `domain/value-objects/Money.test.ts` | min, max, NaN, fromString, equals | 7 |
| `domain/value-objects/CardNumber.test.ts` | 16 dígitos, con espacios, formato, longitud inválida, Luhn | 5 |
| `application/validation/PaymentFormValidator.test.ts` | campos válidos, cada campo inválido, tarjeta vencida (mismo año mes pasado), mes actual válido, año pasado | 12 |
| `application/use-cases/CreatePaymentUseCase.test.ts` | tokenización + procesamiento, logger, mocks tipados | 2 |
| **Total** | | **26** |

### 10.3 CI — `.github/workflows/ci.yml`

Dos jobs en paralelo en cada push/PR a `main`:
- `frontend`: Node 20, `npm ci`, `npm test -- --run`, `npm run build`
- `backend`: Deno v2, `deno test supabase/functions/_shared --allow-all`

---

## 11. Despliegue

### 11.1 Backend

```bash
# Aplicar migraciones
supabase db push

# Desplegar Edge Functions
supabase functions deploy create-payment mp-webhook

# Configurar secrets (primera vez)
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
supabase secrets set MP_WEBHOOK_SECRET=<secret-del-dashboard-mp>
supabase secrets set ALLOWED_ORIGIN=https://mp-checkout-eight.vercel.app

# Ver logs en tiempo real
supabase functions logs create-payment --tail
supabase functions logs mp-webhook --tail
```

### 11.2 Frontend

Vercel auto-deploya en cada push a `main`. Build local:
```bash
cd frontend && npm install && npm run dev  # desarrollo local
npm test -- --run                          # tests
npm run build                              # build de producción
```

### 11.3 Webhook de Mercado Pago

URL configurada en Dashboard MP → Tu aplicación → Webhooks:
```
https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/mp-webhook
```
Eventos suscritos: `orders_v2`

---

## 12. Decisiones técnicas

### Orders API vs Payments API

Se usa `/v1/orders` — la Payments API está en proceso de deprecación. IDs alfanuméricos (`PAY01KRRYWV3DR538...`). El quality checker oficial de MP todavía no soporta la Orders API.

### `processing_mode: automatic`

Un solo request con el token. No requiere dos pasos. La Orders API en modo automático no acepta `payer.first_name`, `payer.last_name` ni `statement_descriptor`.

### items[] en modo automatic

La documentación oficial del Orders API incluye `items[]` en el request. Se envía un item por pago. Si el campo "Concepto de pago" está vacío, el título es `'Pago'` por defecto.

### issuer_id desde BIN detection

`mp.getPaymentMethods({ bin })` retorna `issuer.id`. Se captura y envía como `issuer_id` condicional en `payment_method`. Solo se incluye si está disponible.

### Installments dinámicos

`mp.getInstallments({ amount, bin, paymentTypeId })` retorna `payer_costs[]` con `recommended_message` real de MP (ej. "3 meses de $33.33"). Se dispara cuando hay 6+ dígitos y monto ≥ $10. Fallback a lista estática mientras no hay datos.

### Rate limiting con Deno KV

`Deno.openKv()` a nivel de módulo — compartido entre invocaciones del mismo isolate. Sliding window: timestamps de los últimos N requests por IP filtrados por ventana de tiempo. TTL automático. Sin dependencias externas.

### Re-fetch en webhook

El cuerpo del webhook no se usa para actualizar el estado. Siempre se re-fetcha desde MP API para evitar manipulación.

### State machine de PaymentStatus

`isValidTransition(from, to)` con `Map<PaymentStatus, Set<PaymentStatus>>`. Centraliza las reglas de negocio sobre transiciones válidas. Estados terminales no tienen entradas en el mapa.

### `_shared` pattern en Edge Functions

Supabase no soporta paquetes npm locales. El patrón `_shared/` permite compartir código con imports relativos. El bundler incluye los archivos transitivos automáticamente.

### Service Role en Edge Functions

`SUPABASE_SERVICE_ROLE_KEY` auto-inyectada bypasea RLS. Nunca debe llegar al frontend.

### `formKey` para reset

`key={formKey}` en `<form>` fuerza desmount/remount completo. Limpia autocompletado del navegador además del estado de React.

### No Zustand

Estado del formulario completamente con React hooks nativos. `usePaymentForm` retorna `[state, handlers]`. No se requiere estado global.

### ARIA y accesibilidad

Todos los campos: `htmlFor`/`id`, `aria-required`, `aria-invalid`, `aria-describedby` → `<span role="alert">`. Botón con `aria-busy`. Tras validación fallida, `requestAnimationFrame` mueve el foco al primer campo inválido.

### ErrorBoundary

Clase React para capturar errores de runtime. Sin ErrorBoundary, un error en render crashea toda la app silenciosamente. El botón "Reintentar" llama a `setState({ hasError: false })` para recuperar el estado sin recargar la página.
