# Documentación de integración — Mercado Pago

## Índice

1. [Decisiones de arquitectura](#1-decisiones-de-arquitectura)
2. [Flujo completo de un pago](#2-flujo-completo-de-un-pago)
3. [Frontend](#3-frontend)
4. [Backend — create-payment](#4-backend--create-payment)
5. [Webhook — mp-webhook](#5-webhook--mp-webhook)
6. [Seguridad](#6-seguridad)
7. [Variables de entorno y secretos](#7-variables-de-entorno-y-secretos)
8. [Despliegue](#8-despliegue)
9. [Quality checklist de Mercado Pago](#9-quality-checklist-de-mercado-pago)
10. [Limitaciones conocidas](#10-limitaciones-conocidas)
11. [Próximos pasos sugeridos](#11-próximos-pasos-sugeridos)

---

## 1. Decisiones de arquitectura

### API elegida: Orders API (`/v1/orders`)

Esta integración usa la **Orders API** de Mercado Pago, no la Payments API (`/v1/payments`).

| | Orders API | Payments API |
|---|---|---|
| Endpoint | `POST /v1/orders` | `POST /v1/payments` |
| ID de pago | Alfanumérico (`PAY01KRRYWV3DR538...`) | Numérico (`123456789`) |
| Estado | API actual y en crecimiento | En proceso de deprecación |
| Quality checker de MP | No compatible aún | Compatible |

La Payments API quedará obsoleta. La Orders API es el estándar futuro de Mercado Pago, razón por la cual esta integración la adopta desde el inicio.

### Modo de procesamiento: `automatic`

Se usa `processing_mode: "automatic"` — el pago se procesa en un solo request con el token de tarjeta. No requiere dos pasos.

**Campos no aceptados en modo automatic**: `payer.first_name`, `payer.last_name`, `statement_descriptor`. Enviarlos causa error 400 "Properties not supported".

### Tokenización: Core Methods

Se usa `mp.createCardToken()` del SDK oficial de MercadoPago.js v2. Los datos de la tarjeta **nunca llegan al servidor propio** — van directo del navegador a los servidores de Mercado Pago y regresan como un token de un solo uso.

---

## 2. Flujo completo de un pago

```
┌─────────────────────────────────────────────────────────────────┐
│ NAVEGADOR (mp-checkout-eight.vercel.app)                        │
│                                                                 │
│  Usuario llena el formulario                                    │
│  (monto, concepto, número de tarjeta, nombre, vencimiento,      │
│   CVV, RFC/CURP/INE, email)                                     │
│                    │                                            │
│  6+ dígitos de tarjeta:                                         │
│  mp.getPaymentMethods({ bin }) ──▶ cardBrand, issuerId          │
│  mp.getInstallments({ bin, amount }) ──▶ payer_costs[]          │
│                    │                                            │
│                    ▼                                            │
│  mp.createCardToken({ cardNumber, ... })                        │
│         │  Datos de tarjeta van directo a MP (PCI ✓)           │
│         ▼                                                       │
│  MP devuelve: token = "677859ef..."  (efímero)                  │
│         │                                                       │
│         ▼                                                       │
│  POST /functions/v1/create-payment                              │
│  { token, amount, payerEmail, paymentMethodId,                  │
│    paymentMethodType, issuerId, installments,                   │
│    itemTitle, itemDescription }                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTION — create-payment                         │
│                                                                 │
│  Rate limiting: 10 req/min por IP (Deno KV)                    │
│  Valida monto ($10 – $999,999 MXN)                             │
│  Genera externalReference (UUID) en el servidor                 │
│  Genera X-Idempotency-Key (UUID) por request                   │
│                    │                                            │
│                    ▼                                            │
│  POST api.mercadopago.com/v1/orders                             │
│  {                                                              │
│    type: "online",                                              │
│    processing_mode: "automatic",                                │
│    external_reference: "<uuid>",                                │
│    total_amount: "100.00",                                      │
│    payer: { email },                                            │
│    items: [{ id, title, category_id, quantity, unit_price }],   │
│    transactions: {                                              │
│      payments: [{                                               │
│        amount: "100.00",                                        │
│        payment_method: { id, type, token, installments,         │
│                          issuer_id }                            │
│      }]                                                         │
│    }                                                            │
│  }                                                              │
│                    │                                            │
│                    ▼                                            │
│  INSERT INTO payments                                           │
│  Retorna: { orderId, paymentId, status, statusDetail }          │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼  (asincrónico, via webhook)
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTION — mp-webhook                             │
│                                                                 │
│  Rate limiting: 100 req/min por IP (Deno KV)                   │
│  Valida firma HMAC-SHA256 + anti-replay ±5 min                  │
│  Re-fetcha estado real desde MP API                             │
│  Valida state machine (pending→processed|failed, etc.)         │
│  UPDATE payments SET status, status_detail                      │
│  Siempre responde 200 (evita retries de MP)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend

**Archivos principales:**
- `src/modules/checkout/presentation/hooks/useMercadoPago.ts` — inicialización del SDK
- `src/modules/checkout/presentation/hooks/usePaymentForm.ts` — lógica del formulario
- `src/modules/checkout/presentation/components/PaymentForm/PaymentForm.tsx` — UI
- `src/modules/checkout/presentation/components/CardPreview/CardPreview.tsx` — preview 3D
- `src/types/mercadopago.d.ts` — tipos TypeScript del SDK

### Inicialización del SDK (`useMercadoPago.ts`)

```typescript
new window.MercadoPago(PUBLIC_KEY, { locale: 'es-MX' })
```

Polling cada 100ms hasta que `window.MercadoPago` esté disponible. Mientras `ready=false`, el botón de pago está deshabilitado.

### BIN detection

Al escribir 6+ dígitos de tarjeta, `usePaymentForm` llama automáticamente:

```typescript
mp.getPaymentMethods({ bin: digits.slice(0, 6) })
// → { id: 'visa', payment_type_id: 'credit_card', issuer: { id: 1234 } }
```

Resultado: actualiza logo de marca en CardPreview, `paymentMethodId`, `paymentMethodType` e `issuerId` que se enviarán al backend. Patrón de cancelación (`cancelled = true`) para evitar race conditions.

### Installments dinámicos

Cuando hay 6+ dígitos y monto ≥ $10 MXN, se llama:

```typescript
mp.getInstallments({ amount: '100.00', bin: '450995', paymentTypeId: 'credit_card' })
// → [{ payer_costs: [{ installments: 1, recommended_message: '1 mes sin intereses' }, ...] }]
```

El select de meses muestra los `recommended_message` reales de MP. Fallback a `[1, 3, 6, 9, 12, 18]` mientras no hay datos.

### Campos del formulario

| Campo | Notas |
|---|---|
| Monto | Mínimo $10 MXN, validado también en servidor |
| Concepto de pago | Opcional — pasa como `itemTitle`/`itemDescription` al backend |
| Email | Validación regex, normalizado a lowercase |
| Número de tarjeta | Luhn + longitud 13–19, formateado con espacios cada 4 dígitos |
| Nombre del titular | Convertido a mayúsculas |
| Mes / Año | Validación combinada: mismo año + mes pasado → "Tarjeta vencida" |
| CVV | 3–4 dígitos, voltea la tarjeta al enfocar; sin `name` attribute |
| Meses | Dinámico desde MP o fallback hardcoded |
| Documento | Selector RFC / CURP / INE + número |

### Logos de marca (CardPreview)

Detectados automáticamente vía BIN detection:

| `payment_method_id` | Logo |
|---|---|
| `visa` | "VISA" cursiva en blanco |
| `master`, `mastercard`, `debmaster` | Dos círculos solapados rojo + naranja |
| `amex`, `american_express` | "AMEX" en caja |
| `discover` | "DISCOVER" con círculo naranja |

### Manejo de errores del SDK

```typescript
const SDK_CODES: Record<string, string> = {
  '205': 'Ingresa el nombre del titular',
  '208': 'Mes de vencimiento inválido',
  '209': 'Año de vencimiento inválido',
  '212': 'Tipo de documento inválido',
  '214': 'Número de documento inválido',
  '224': 'CVV inválido',
  'E301': 'Número de tarjeta inválido',
  'E302': 'CVV inválido',
  '316': 'Nombre del titular inválido',
  '325': 'Mes de vencimiento inválido',
  '326': 'Año de vencimiento inválido',
};
```

### ARIA / accesibilidad

Todos los campos tienen `htmlFor`/`id`, `aria-required`, `aria-invalid`, `aria-describedby` apuntando al `<span role="alert">` del error. El botón tiene `aria-busy` durante loading. Tras validación fallida, el foco se mueve automáticamente al primer campo inválido.

---

## 4. Backend — `create-payment`

**URL**: `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/create-payment`  
**Runtime**: Deno (Supabase Edge Functions)

### Request esperado del frontend

```typescript
{
  token: string,              // Token de tarjeta generado por MP SDK
  amount: number,             // Monto en MXN
  installments: number,       // Cuotas (1–48)
  payerEmail: string,
  paymentMethodId: string,    // "visa", "master", etc.
  paymentMethodType: string,  // "credit_card", "debit_card"
  issuerId?: number,          // Del BIN detection (method.issuer?.id)
  itemTitle?: string,         // Del campo "Concepto de pago"
  itemDescription?: string,
}
```

### Validaciones en servidor

- `token`: string no vacío
- `amount`: `Money.of(parseFloat(...))` — mín $10, máx $999,999 MXN
- `payerEmail`: `Email.of(...)` — formato email, normalizado a lowercase
- `paymentMethodType`: allowlist de tipos conocidos
- `installments`: entero entre 1 y 48
- `externalReference`: generado internamente (`crypto.randomUUID()`) — nunca acepta valor del cliente
- `itemTitle`: default `'Pago'` si vacío o ausente

### Body enviado a MP Orders API

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "external_reference": "<uuid-generado-en-servidor>",
  "total_amount": "100.00",
  "payer": { "email": "pagador@ejemplo.com" },
  "items": [{
    "id": "<external_reference>",
    "title": "Pago",
    "category_id": "services",
    "quantity": 1,
    "unit_price": "100.00"
  }],
  "transactions": {
    "payments": [{
      "amount": "100.00",
      "payment_method": {
        "id": "visa",
        "type": "credit_card",
        "token": "677859ef...",
        "installments": 1,
        "issuer_id": 1234
      }
    }]
  }
}
```

`issuer_id` solo se incluye si está disponible (campo condicional).

### Respuesta al frontend

```typescript
// Éxito
{ orderId: "PAY01...", paymentId: "...", status: "processed", statusDetail: "accredited" }

// Error
{ message: "Fondos insuficientes" }
```

### Mapeo de errores de MP

```typescript
{
  insufficient_amount: 'Fondos insuficientes',
  bad_filled_security_code: 'CVV inválido',
  bad_filled_card_data: 'Error en los datos de la tarjeta',
  bad_filled_date: 'Fecha de vencimiento incorrecta',
  rejected_by_issuer: 'Pago rechazado por el banco emisor',
  call_for_authorize: 'Llama a tu banco para autorizar el pago',
  card_disabled: 'Tarjeta deshabilitada',
  duplicated_payment: 'Pago duplicado',
  high_risk: 'Pago rechazado por riesgo',
  // ...
}
```

---

## 5. Webhook — `mp-webhook`

**URL**: `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/mp-webhook`  
**Desplegado con**: `supabase functions deploy mp-webhook` (sin `--no-verify-jwt` — Supabase lo maneja internamente para webhooks externos)

### Por qué es necesario

MP requiere un endpoint de notificaciones para cambios de estado de pago (aprobado tardío, reembolso, disputa). El webhook re-fetcha el estado real desde MP API y actualiza la base de datos.

### Validación de firma HMAC-SHA256 (obligatoria)

`MP_WEBHOOK_SECRET` es un env var **requerido** — el proceso falla al startup si falta. Todo request sin `x-signature` es rechazado con 401.

El mensaje a firmar:
```
id:<data.id>;request-id:<X-Request-Id>;ts:<ts_del_header>;
```

Anti-replay: si `|now - ts| > 300s` (±5 minutos), el request es rechazado con 401.

La comparación usa XOR bit a bit (tiempo constante) para prevenir timing attacks.

```
x-signature: ts=1730821302,v1=abc123def456...
x-request-id: a1b2c3d4-...
```

### Flujo completo

```
1.  Rate limit (100/min por IP) — si excedido: ack 200 (no 429, para no disparar retries de MP)
2.  Sin x-signature → 401
3.  Parsea type y resourceId del body
4.  Tipo no soportado → ack 200 silencioso (sin error)
5.  Valida HMAC + anti-replay → 401 si falla
6.  Re-fetcha estado real: MercadoPagoGateway.fetchPayment(resourceId)
7.  Verifica que la orden exista en DB → si no: warn + ack
8.  Idempotencia: status ya igual → info + ack (sin UPDATE)
9.  State machine: isValidTransition(existing, new) → si inválida: warn + ack
10. UPDATE payments SET status = newStatus, status_detail = detail
11. Siempre retorna 200 { received: true }
```

### State machine de estados

```
pending → processed | failed
processed → refunded
failed → (terminal, no cambia)
refunded → (terminal, no cambia)
```

### Re-fetch vs. confiar en el payload

El cuerpo del webhook no se usa para actualizar el estado. Siempre se re-fetcha el recurso desde la API de MP para evitar manipulación en ataques man-in-the-middle.

### Configuración en MP

Panel de MP → Tu aplicación → Webhooks:
- URL: `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/mp-webhook`
- Eventos: `orders_v2`

---

## 6. Seguridad

### PCI DSS

El formulario **nunca envía datos de tarjeta a los servidores propios**. Los datos van directo del navegador a MP via SDK. Solo regresa un token de un solo uso (SAQ A-EP).

### Datos almacenados en DB

| Dato | ¿Se almacena? |
|---|---|
| Número de tarjeta | ❌ Nunca |
| CVV | ❌ Nunca |
| Fecha de vencimiento | ❌ Nunca |
| Nombre del titular | ❌ Nunca |
| Email del pagador | ✅ En tabla `payments` |
| Monto | ✅ En tabla `payments` |
| Order ID / Payment ID | ✅ En tabla `payments` |
| Status y status_detail | ✅ En tabla `payments` |

### Medidas implementadas

| Medida | Detalle |
|---|---|
| Rate limiting | Deno KV: 10/min en create-payment, 100/min en webhook |
| Validación de monto en servidor | $10 mín, $999,999 máx |
| `externalReference` en servidor | El cliente no controla este valor |
| HMAC obligatorio en webhook | `MP_WEBHOOK_SECRET` requerido; sin firma → 401 |
| Anti-replay de webhook | Timestamp fuera de ±5 min → 401 |
| Re-fetch del estado | Nunca se confía en el payload del webhook |
| State machine | Transiciones inválidas son ignoradas |
| Idempotencia de webhook | Status igual = no-op |
| CORS estricto | `ALLOWED_ORIGIN` sin wildcard |
| RLS + constraints de DB | Deny all para anon/authenticated; campos inmutables |
| Security headers frontend | CSP, HSTS, X-Frame-Options, Permissions-Policy |
| Logger noop en producción | Sin datos sensibles en DevTools |
| robots.txt | Disallow: / — no indexable |

### Security headers del frontend (`vercel.json`)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: payment=(), camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com;
  connect-src 'self' https://*.supabase.co https://api.mercadopago.com;
  img-src 'self' data: https://http2.mlstatic.com; frame-ancestors 'none';
  object-src 'none'; base-uri 'self'; form-action 'self'
```

---

## 7. Variables de entorno y secretos

### Frontend (Vercel / `.env.local`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_MP_PUBLIC_KEY` | Clave pública de MP | `APP_USR-20c81069-...` |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://nvrhzqmnxdzkffnpjqkf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase (pública) | `eyJhbGci...` |

### Backend (Supabase Secrets)

| Secret | Descripción | Requerido |
|---|---|---|
| `MP_ACCESS_TOKEN` | Access token de MP (nunca al frontend) | ✅ Sí |
| `ALLOWED_ORIGIN` | Dominio del frontend para CORS | ✅ Sí |
| `MP_WEBHOOK_SECRET` | Secret HMAC para validar firma de webhooks | ✅ Sí |

```bash
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
supabase secrets set ALLOWED_ORIGIN=https://mp-checkout-eight.vercel.app
supabase secrets set MP_WEBHOOK_SECRET=<secret-del-panel-mp>
```

---

## 8. Despliegue

### Frontend — Vercel

- Repositorio: `https://github.com/cedenoluisparra-prog/mp-checkout`
- Rama: `main` — auto-deploy en cada push
- URL: `https://mp-checkout-eight.vercel.app`

### Backend — Supabase Edge Functions

- Proyecto: `nvrhzqmnxdzkffnpjqkf`

```bash
# Migraciones
supabase db push

# Edge Functions
supabase functions deploy create-payment mp-webhook

# Logs
supabase functions logs create-payment --tail
supabase functions logs mp-webhook --tail
```

### CI/CD — GitHub Actions

`.github/workflows/ci.yml` — en cada push/PR a `main`:
- Job `frontend`: `npm ci` + `npm test -- --run` + `npm run build`
- Job `backend`: `deno test supabase/functions/_shared --allow-all`

---

## 9. Quality checklist de Mercado Pago

### Contexto

El quality checker oficial de MP evalúa pagos por `payment_id` numérico (Payments API). La Orders API genera IDs alfanuméricos (`PAY01KRRYWV3DR538...`) que el evaluador no reconoce todavía.

### Estado por ítem

| Ítem | Estado | Notas |
|---|---|---|
| Email del comprador | ✅ | `payer.email` enviado |
| Nombre / Apellido del comprador | ❌ | Orders API modo auto no acepta estos campos (error 400) |
| Items (título, precio, cantidad) | ✅ | Enviado en `items[]` |
| Device ID | ✅ | SDK JS v2 lo maneja automáticamente |
| Issuer ID | ✅ | Capturado vía BIN detection, enviado como `issuer_id` |
| Webhooks | ✅ | Configurado, valida HMAC, actualiza DB |
| Referencia externa | ✅ | Generada en servidor |
| Backend SDK | ❌ | No hay SDK oficial de MP para Deno |
| Frontend SDK | ✅ | MercadoPago.js v2 |
| Statement descriptor | ❌ | No soportado en Orders API |
| SSL / TLS 1.2+ | ✅ | Vercel provee TLS 1.3 |
| Formulario PCI | ✅ | `createCardToken` vía SDK |
| Mensajes de respuesta al usuario | ✅ | Mensajes en español |
| Consulta pago notificado (re-fetch) | ✅ | Siempre se re-fetcha desde MP API |
| Logo de Mercado Pago visible | ✅ | En header del formulario |
| Identificación del comprador | ✅ | RFC/CURP/INE en tokenización |

Los ítems ❌ son limitaciones de la Orders API en modo automático, no de la implementación.

---

## 10. Limitaciones conocidas

### `payer.first_name` / `payer.last_name`

La Orders API en modo `automatic` rechaza estos campos con error 400. No están implementados.

### Backend SDK de MP para Deno

No existe SDK oficial de MP compatible con Deno/Edge Functions. Se usa la API REST directamente con `fetch`.

### `statement_descriptor`

Solo soportado en la Payments API. No aplica a Orders API.

### Quality evaluation no compatible

La herramienta `quality_evaluation` del MCP de MP requiere `payment_id` numérico. No aplica a Orders API.

### IDs alfanuméricos

Los pagos de la Orders API tienen IDs tipo `PAY01...`. El webhook re-fetcha correctamente usando el endpoint de órdenes (`/v1/orders/{id}`).

---

## 11. Próximos pasos sugeridos

### Para producción real

1. **Tarjetas guardadas** — implementar Customers API de MP para guardar tarjetas y permitir pagos con un clic en futuras visitas.

2. **Email de confirmación** — al actualizar status a `processed` en el webhook, disparar un email de confirmación al pagador (SendGrid, Resend, etc.).

3. **Dashboard de pagos** — tabla en Supabase con `payments` ya existe; construir una vista admin para ver estado de pagos.

4. **Tabla de webhooks procesados** — para idempotencia completa con side-effects (emails, fulfillment), una tabla `processed_webhook_events` con el `x-request-id` previene ejecución duplicada.

### Tarjetas de prueba (México)

| Resultado | Número | CVV | Vencimiento | Documento |
|---|---|---|---|---|
| Aprobada (Visa) | `4509953566233704` | `123` | `11/25` | RFC: `XAXX010101000` |
| Aprobada (Mastercard) | `5031755734530604` | `123` | `11/25` | RFC: `XAXX010101000` |
| Rechazada (fondos) | `4000000000000002` | `123` | `11/25` | RFC: `XAXX010101000` |
