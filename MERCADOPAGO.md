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

La Payments API quedará obsoleta. La Orders API es el estándar futuro de Mercado Pago, razón por la cual esta integración la adopta desde el inicio, aunque el quality checker oficial de MP todavía no la evalúa correctamente.

### Modo de procesamiento: `automatic`

Se usa `processing_mode: "automatic"` — el pago se procesa en un solo request con el token de tarjeta. El modo `manual` (que sí soporta `items`) requiere un flujo de dos pasos y no aplica para este caso de uso.

### Tokenización: Core Methods

Se usa `mp.createCardToken()` del SDK oficial de MercadoPago.js v2. Los datos de la tarjeta **nunca llegan al servidor propio** — van directo del navegador a los servidores de Mercado Pago y regresan como un token de un solo uso.

---

## 2. Flujo completo de un pago

```
┌─────────────────────────────────────────────────────────────┐
│ NAVEGADOR (mp-checkout-eight.vercel.app)                    │
│                                                             │
│  Usuario llena el formulario                                │
│  (número, nombre, vencimiento, CVV, RFC/CURP/INE, email)    │
│                    │                                        │
│                    ▼                                        │
│  mp.getPaymentMethods({ bin })  ──▶  Detecta Visa/MC/etc.  │
│                    │                                        │
│                    ▼                                        │
│  mp.createCardToken({ cardNumber, ... })                    │
│         │                                                   │
│         │  Datos de tarjeta van directo a MP (PCI ✓)       │
│         ▼                                                   │
│  MP devuelve: token = "677859ef..."  (expira en 7 días)    │
│         │                                                   │
│         ▼                                                   │
│  POST /functions/v1/create-payment                          │
│  { token, amount, payerEmail, paymentMethodId, ... }        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼  (Supabase valida JWT del anon key)
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTION — create-payment                     │
│                                                             │
│  Valida monto ($10 – $999,999 MXN)                         │
│  Genera externalReference (UUID) en el servidor             │
│  Genera X-Idempotency-Key (UUID)                            │
│                    │                                        │
│                    ▼                                        │
│  POST api.mercadopago.com/v1/orders                         │
│  {                                                          │
│    type: "online",                                          │
│    processing_mode: "automatic",                            │
│    external_reference: "<uuid>",                            │
│    total_amount: "100.00",                                  │
│    payer: { email },                                        │
│    transactions: {                                          │
│      payments: [{                                           │
│        amount: "100.00",                                    │
│        payment_method: { id, type, token, installments }    │
│      }]                                                     │
│    }                                                        │
│  }                                                          │
│                    │                                        │
│                    ▼                                        │
│  MP responde: { id: "01J...", status, transactions }        │
│                    │                                        │
│                    ▼                                        │
│  Devuelve al frontend:                                      │
│  { id: "PAY01...", status, detail, order_id }               │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼  (paralelo, asincrónico)
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE EDGE FUNCTION — mp-webhook                         │
│                                                             │
│  MP notifica cambios de estado del pago                     │
│  Valida firma HMAC-SHA256 (si MP_WEBHOOK_SECRET está set)   │
│  Re-fetcha estado real desde MP API                         │
│  Loguea resultado                                           │
│  Responde 200 a MP                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend

**Archivos relevantes:**
- `frontend/src/hooks/useMercadoPago.ts` — inicialización del SDK
- `frontend/src/components/PaymentForm.tsx` — formulario principal
- `frontend/src/components/CardPreview.tsx` — visualización de tarjeta 3D
- `frontend/src/types/mercadopago.d.ts` — tipos TypeScript del SDK
- `frontend/index.html` — carga del SDK via `<script src="https://sdk.mercadopago.com/js/v2">`

### Inicialización del SDK (`useMercadoPago.ts`)

```typescript
new window.MercadoPago(PUBLIC_KEY, { locale: 'es-MX' })
```

El SDK se carga desde la CDN de MP con el `locale` de México. El hook espera con `setInterval` hasta que `window.MercadoPago` esté disponible.

### Flujo del formulario (`PaymentForm.tsx`)

1. **Detección del método de pago** — al escribir los primeros 6 dígitos (BIN), se llama `mp.getPaymentMethods({ bin })` para identificar la red (Visa, Mastercard, etc.) y obtener el `payment_method_id`.

2. **Tokenización** — al hacer submit, se llama `mp.createCardToken()` con todos los datos de la tarjeta. Si hay error, se mapea el código de error del SDK a un mensaje en español.

3. **Request al backend** — solo el token (nunca datos de tarjeta), monto, email y método de pago.

4. **Validación client-side** — monto mínimo $10 MXN, email válido, todos los campos requeridos, antes de llamar al SDK.

### Campos del formulario

| Campo | Notas |
|---|---|
| Monto | Mínimo $10 MXN, validado también en servidor |
| Email | Validación de formato regex |
| Número de tarjeta | Formateado con espacios cada 4 dígitos, máx 16 dígitos |
| Nombre del titular | Convertido a mayúsculas (requerimiento de tarjetas) |
| Mes / Año | Separados para compatibilidad con el SDK |
| CVV | 3-4 dígitos; voltea la tarjeta al enfocar |
| Documento | Selector de tipo (RFC / CURP / INE) + número |

### Manejo de errores del SDK

```typescript
const SDK_CODES: Record<string, string> = {
  '205': 'Ingresa el nombre del titular',
  '208': 'Mes de vencimiento inválido',
  '209': 'Año de vencimiento inválido',
  '212': 'Tipo de documento inválido',
  '214': 'Número de documento inválido',
  '221': 'Ingresa el nombre del titular',
  '224': 'CVV inválido',
  'E301': 'Número de tarjeta inválido',
  'E302': 'CVV inválido',
  '316': 'Nombre del titular inválido',
  '325': 'Mes de vencimiento inválido',
  '326': 'Año de vencimiento inválido',
};
```

---

## 4. Backend — `create-payment`

**Archivo:** `supabase/functions/create-payment/index.ts`
**URL:** `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/create-payment`
**Runtime:** Deno (Supabase Edge Functions)

### Request esperado

```typescript
{
  token: string,           // Token de tarjeta generado por MP SDK
  amount: number,          // Monto en MXN
  installments?: number,   // Cuotas (default: 1)
  payerEmail: string,      // Email del pagador
  paymentMethodId: string, // "visa", "master", etc.
  paymentMethodType: string, // "credit_card", "debit_card"
}
```

### Validaciones en servidor

- `token` requerido
- `amount` debe ser número, mínimo $10, máximo $999,999 MXN
- El `externalReference` se genera en el servidor (nunca viene del cliente)
- El `X-Idempotency-Key` se genera en el servidor por request

### Body enviado a MP Orders API

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "external_reference": "<uuid-generado-en-servidor>",
  "total_amount": "100.00",
  "payer": { "email": "pagador@ejemplo.com" },
  "transactions": {
    "payments": [{
      "amount": "100.00",
      "payment_method": {
        "id": "visa",
        "type": "credit_card",
        "token": "677859ef...",
        "installments": 1
      }
    }]
  }
}
```

**Nota:** La Orders API en modo `automatic` no acepta `items`, `statement_descriptor`, ni campos extendidos de `payer` (first_name, last_name, identification). Intentar enviarlos resulta en error 400 "Properties not supported".

### Respuesta al frontend

```typescript
// Éxito
{ id: "PAY01...", status: "processed", detail: "accredited", order_id: "01J..." }

// Error
{ message: "Fondos insuficientes", status_detail: "insufficient_amount" }
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

**Archivo:** `supabase/functions/mp-webhook/index.ts`
**URL:** `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/mp-webhook`
**Desplegado con:** `--no-verify-jwt` (Supabase no requiere token; MP no puede proveerlo)

### Por qué es necesario

MP requiere un endpoint de notificaciones para su quality checklist. Además, en producción real es la manera confiable de conocer cambios de estado de un pago (aprobado tardío, reembolso, disputa).

### Flujo de validación de firma

MP firma cada notificación con HMAC-SHA256. El mensaje a firmar es:

```
id:<data.id>;request-id:<X-Request-Id>;ts:<ts_del_header>;
```

El webhook valida la firma **solo si** `MP_WEBHOOK_SECRET` está configurado **y** el header `x-signature` está presente. Si la firma está ausente (tests de conectividad), se acepta con un log de advertencia.

```
x-signature: ts=1730821302,v1=abc123def456...
x-request-id: a1b2c3d4-...
```

### Lógica actual

```
Recibe notificación
  → Valida firma (si aplica)
  → Re-fetcha estado desde MP API  ← siempre verifica con MP, nunca confía en el payload
  → Loguea { type, id, status, external_reference }
  → Responde 200 (siempre, para que MP no reintente)
```

### Tópicos suscritos

- `payment` — cambios en pagos
- `order` — cambios en órdenes

### Limitación actual

El webhook solo **loguea** — no actualiza base de datos ni ejecuta lógica de negocio. Para producción real se debe agregar lógica según el `status` del recurso re-fetcheado.

### Configuración en MP

Configurado vía MCP en la aplicación `1200717449426729`:
- URL producción: `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/mp-webhook`
- URL sandbox: `https://nvrhzqmnxdzkffnpjqkf.supabase.co/functions/v1/mp-webhook`

---

## 6. Seguridad

### PCI DSS

El formulario **nunca envía datos de tarjeta a los servidores propios**. Los datos viajan directo del navegador a los servidores de MP mediante el SDK oficial, y solo regresa un token de un solo uso. Esto minimiza el alcance PCI al nivel más bajo posible (SAQ A-EP).

### Datos almacenados

| Dato | ¿Se almacena? |
|---|---|
| Número de tarjeta | ❌ Nunca |
| CVV | ❌ Nunca |
| Fecha de vencimiento | ❌ Nunca |
| Nombre del titular | ❌ Nunca |
| Email del pagador | Solo en logs temporales de Supabase |
| Monto | Solo en logs temporales de Supabase |
| Order ID / Payment ID | Solo en logs temporales de Supabase |

### Medidas implementadas

| Medida | Detalle |
|---|---|
| Validación de monto en servidor | $10 mínimo, $999,999 máximo; el frontend no puede manipularlo |
| `externalReference` generado en servidor | El cliente no controla este valor |
| Sin `debug` en respuestas de error | La respuesta de error solo incluye mensaje amigable, no el objeto crudo de MP |
| CORS restringido | `Access-Control-Allow-Origin` limitado al dominio de Vercel |
| Firma HMAC en webhook | Validación criptográfica de notificaciones cuando el secret está configurado |
| HTTPS/TLS 1.3 | Provisto por Vercel (frontend) y Supabase (backend) |
| `MP_ACCESS_TOKEN` como secreto | Nunca expuesto en el frontend ni en el repositorio |

### Medida pendiente

Configurar el secret completo del webhook para activar la validación de firma en notificaciones reales:

```bash
supabase secrets set MP_WEBHOOK_SECRET=<secret-completo-del-panel-de-mp>
```

El secret se obtiene en: **Developers > Tu aplicación > Webhooks** en el panel de MP.

---

## 7. Variables de entorno y secretos

### Frontend (Vercel / `.env.local`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_MP_PUBLIC_KEY` | Clave pública de MP | `APP_USR-20c81069-...` |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://nvrhzqmnxdzkffnpjqkf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase (pública) | `eyJhbGci...` |

> `VITE_*` variables quedan expuestas en el bundle del frontend. Usar solo claves públicas aquí.

### Backend (Supabase Secrets)

| Secret | Descripción | Requerido |
|---|---|---|
| `MP_ACCESS_TOKEN` | Access token de MP (nunca al frontend) | ✅ Sí |
| `ALLOWED_ORIGIN` | Dominio del frontend para CORS | ✅ Sí |
| `MP_WEBHOOK_SECRET` | Secret HMAC para validar firma de webhooks | ⚠️ Pendiente |

```bash
# Ver secretos configurados
supabase secrets list

# Configurar
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
supabase secrets set ALLOWED_ORIGIN=https://mp-checkout-eight.vercel.app
supabase secrets set MP_WEBHOOK_SECRET=<secret-del-panel-mp>
```

---

## 8. Despliegue

### Frontend — Vercel

- Repositorio: `https://github.com/cedenoluisparra-prog/mp-checkout`
- Rama: `main`
- Auto-deploy: Vercel despliega automáticamente en cada push a `main`
- URL: `https://mp-checkout-eight.vercel.app`
- Configuración: `frontend/vercel.json` (rewrite SPA: `/* → /index.html`)

```bash
# Deploy manual (si no hay CI/CD configurado)
cd frontend && vercel --prod
```

### Backend — Supabase Edge Functions

- Proyecto: `nvrhzqmnxdzkffnpjqkf`
- Functions desplegadas: `create-payment`, `mp-webhook`

```bash
# Desplegar funciones
supabase functions deploy create-payment
supabase functions deploy mp-webhook --no-verify-jwt

# Ver logs en tiempo real
supabase functions logs create-payment --tail
supabase functions logs mp-webhook --tail
```

> `--no-verify-jwt` en `mp-webhook` es **necesario** para que MP pueda llamar al endpoint sin un token de Supabase.

---

## 9. Quality checklist de Mercado Pago

### Contexto

El quality checker oficial de MP evalúa pagos por su `payment_id` numérico (formato de la Payments API). La Orders API genera IDs alfanuméricos (`PAY01KRRYWV3DR538...`) que el evaluador **no reconoce todavía**. La herramienta no ha sido actualizada para la Orders API.

### Estado por ítem

#### Requisitos obligatorios

| Ítem | Estado | Notas |
|---|---|---|
| Email del comprador | ✅ | `payer.email` enviado |
| Nombre / Apellido del comprador | ❌ | Orders API modo auto no acepta estos campos |
| Categoría / Descripción / Código / Cantidad / Nombre / Precio del item | ❌ | `items` solo soportado en modo manual |
| Device ID | ✅ | SDK JS v2 lo maneja automáticamente |
| Issuer ID | ❌ | Orders API lo rechaza en modo auto |
| Webhooks | ✅ | Configurado y funcionando |
| Referencia externa | ✅ | Generada en servidor |
| Backend SDK | ❌ | No hay SDK oficial de MP para Deno |
| Frontend SDK | ✅ | MercadoPago.js v2 |
| Statement descriptor | ❌ | No soportado en Orders API |
| SSL / TLS 1.2+ | ✅ | Vercel provee TLS 1.3 |
| Formulario PCI | ✅ | `createCardToken` vía SDK — datos no pasan por servidor propio |

#### Buenas prácticas

| Ítem | Estado |
|---|---|
| Mensajes de respuesta al usuario | ✅ |
| Consulta pago notificado (webhook re-fetch) | ✅ |
| Logo de Mercado Pago visible | ✅ |
| Identificación del comprador | ✅ (en tokenización, no en el pago) |

### Conclusión

Los ítems marcados ❌ son **limitaciones de la Orders API en modo automático**, no de la implementación. La Orders API es el futuro de MP; el quality checker está diseñado para la Payments API que quedará obsoleta.

---

## 10. Limitaciones conocidas

### Orders API modo automático

La API solo acepta el subconjunto documentado de campos. Enviar campos extra (incluyendo `items`, `payer.first_name`, `statement_descriptor`) resulta en error 400 `Properties not supported`.

### Webhook — solo logs por ahora

El webhook recibe y valida notificaciones correctamente, pero no ejecuta lógica de negocio. Para producción real, se debe implementar la actualización del estado del pedido en base de datos.

### IDs alfanuméricos en el webhook

Cuando MP envía notificaciones `type: "payment"` para pagos de la Orders API, el ID tiene formato `PAY01...`. El webhook intenta consultarlo en `/v1/payments/{id}`, que podría devolver 404. El impacto es nulo actualmente (solo log), pero hay que corregirlo al agregar lógica de negocio real.

### Quality evaluation no compatible

La herramienta `quality_evaluation` del MCP de MP requiere un `payment_id` numérico. Los pagos de la Orders API no pueden evaluarse con esta herramienta hasta que MP la actualice.

---

## 11. Próximos pasos sugeridos

### Prioritarios

1. **Configurar `MP_WEBHOOK_SECRET`** con el valor completo del panel de MP para activar validación de firma HMAC en notificaciones reales.

2. **Agregar lógica de negocio en el webhook** — cuando el status sea `processed` o `approved`, actualizar el estado de la orden en base de datos y/o disparar acciones (email de confirmación, liberación de producto, etc.).

3. **Corregir el endpoint de re-fetch en el webhook** para manejar correctamente IDs de la Orders API (`PAY01...` → consultar `/v1/orders/{order_id}`).

### Opcionales para escalar

4. **Rate limiting** en `create-payment` para prevenir card testing (intentos masivos de tarjetas). Supabase no lo ofrece nativamente; se puede implementar con un contador en Redis/DB.

5. **Guardar `order_id` y `external_reference`** en base de datos al crear el pago, para poder cruzar con las notificaciones del webhook.

6. **Cuotas (MSI)** — llamar a `mp.getInstallments({ amount, bin })` para mostrar opciones de meses sin intereses antes de procesar.

7. **Tarjetas guardadas** — implementar Customers API de MP para guardar tarjetas y permitir pagos con un clic en futuras visitas.
