# mp-checkout

Integración de Mercado Pago con tokenización manual de tarjeta (Checkout API / Core Methods), desplegada en Vercel + Supabase Edge Functions.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite + React + TypeScript — Vercel |
| Tokenización | MercadoPago.js v2 (`createCardToken`) |
| Backend | Supabase Edge Function (Deno) |
| API de pagos | Mercado Pago Orders API `v1/orders` |
| Notificaciones | Supabase Edge Function webhook |

## Setup rápido

```bash
# 1. Variables de entorno del frontend
cp .env.example frontend/.env.local
# Edita VITE_MP_PUBLIC_KEY y VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

# 2. Frontend local
cd frontend && npm install && npm run dev
# → http://localhost:5173

# 3. Secretos del backend
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
supabase secrets set ALLOWED_ORIGIN=https://tu-dominio.vercel.app

# 4. Desplegar funciones
supabase functions deploy create-payment
supabase functions deploy mp-webhook --no-verify-jwt
```

Ver [`MERCADOPAGO.md`](./MERCADOPAGO.md) para documentación completa de la integración.

## Tarjetas de prueba (México)

| Resultado | Número | CVV | Vencimiento | Documento |
|---|---|---|---|---|
| Aprobada (Visa) | `4509953566233704` | `123` | `11/25` | RFC: `XAXX010101000` |
| Aprobada (Mastercard) | `5031755734530604` | `123` | `11/25` | RFC: `XAXX010101000` |
| Rechazada | `4000000000000002` | `123` | `11/25` | RFC: `XAXX010101000` |
