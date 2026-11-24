# Tangible · citas y panel de estudios de uñas

## Cliente y problema

Tangible Nails & Art Studio (Chihuahua). Las clientas piden cita desde el sitio público (`studiotangible.com.mx`, llega desde Instagram) eligiendo servicio y horario libre; la solicitud se confirma por WhatsApp. La dueña lleva agenda, cobros, clientas, notas, horario y tarjeta de sellos desde un panel instalable (PWA) en su iPhone.

Desde octubre 2026 el panel es **multi-estudio**: también lo usa iLoveMe (otro estudio), con datos aislados por `studioId`. El sitio público sigue siendo solo de Tangible.

## Stack y decisiones

- **Next.js 16 (App Router) + React 19 + TypeScript estricto**, desplegado en **Vercel**.
- **MongoDB Atlas con Prisma 5** (`prisma/schema.prisma`). Sin migraciones SQL: los índices se aplican con `npx prisma db push`; los cambios de datos van en scripts de `scripts/` con simulacro por defecto y `--apply`.
- **NextAuth 4** con JWT y bcrypt. Cada cuenta pertenece a un estudio; el estudio sale siempre de la sesión (`src/lib/tenant.ts`), nunca del navegador. `src/lib/tenant-guard.test.ts` falla si una consulta no filtra por estudio.
- **Subdominio del panel** (`admin.<dominio>`) resuelto en `src/proxy.ts` (el antiguo `middleware.ts`). Detalle y orden de despliegue en [docs/studios-y-subdominio.md](docs/studios-y-subdominio.md).
- **Tarjeta de sellos:** activación por QR, código de respaldo o enlace por WhatsApp; el celular de la clienta guarda un pase firmado con `REWARDS_PASS_SECRET`. El sticker NFC da el sello solo el día de su cita.
- **WhatsApp por enlace `wa.me`**, sin API de pago. Plantillas en `src/lib/whatsapp.ts`.
- **Zona horaria** de Chihuahua (UTC-6) en `src/lib/timezone.ts`; no usar la del servidor.
- **PWA solo para el panel** (ver `SETUP-PWA.md`): el sitio público no se instala.
- **Tailwind 3**, tonos miel (se quitó el amarillo fuerte). Modo privacidad para ocultar montos en el panel.
- **Vitest** con Prisma simulado (no toca la base). CI en `.github/workflows/ci.yml`: typecheck, lint y pruebas.
- Versiones exactas en `package.json`.

## Cómo trabajar aquí

```bash
npm ci
cp .env.example .env      # llenar valores
npx prisma generate
npm run dev
```

- Antes de entregar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit`.
- `npm test` pasa por `scripts/vitest.mjs`: en Windows, Vitest 4+ no corre ninguna prueba si la terminal abre en `c:\` (minúscula, como VS Code). No llamar `npx vitest` directo desde ahí.
- Detener `next dev` antes de `prisma generate` o `npm run build`: en Windows el motor de Prisma queda bloqueado (EPERM).
- Si `npm install` truena con `Cannot read properties of null (reading 'edgesOut')` (npm 10), hacer el cambio con `npx npm@11 install ...` y luego `npm install` normal para que el lock quede compatible con npm 10 (el de CI).
- El `.env` local apunta a la base real: probar solo lecturas, o usar una base aparte para flujos que escriben.
- Scripts de datos: `db:backup` (respaldo en `scripts/.backups/`, fuera de git), `studios:migrate`, `users:create`, `notes:convert`, `backfill:customers`. Todos leen `.env`.
- Se trabaja desde la PC y desde la laptop: `git fetch` antes de revisar el estado.

## Pendientes

- Prueba de recorrido con clics (celular y escritorio, sobre el build servido) como comando del proyecto.
- CSP de producción permite `'unsafe-eval'` y `'unsafe-inline'` en scripts (`next.config.ts`); endurecer con nonce.
- `CRON_SECRET` está en `.env` pero ningún código lo usa: confirmar si sobra.
- Confirmar si ya se hicieron los pasos 7 a 11 del subdominio (DNS, `ADMIN_HOST` en Vercel, reinstalar la app).
- Saltos mayores pendientes de evaluar: Prisma 5 → 7 (revisar soporte de MongoDB), Tailwind 3 → 4, ESLint 9 → 10, TypeScript 5 → 7.
- Reescribir los efectos marcados con `eslint-disable-next-line react-hooks/set-state-in-effect` cuando se toquen esos componentes.
