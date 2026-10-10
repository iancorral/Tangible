# Estudios (Tangible + iLoveMe) y subdominio admin

## Cómo funciona

- **Estudios.** Cada dato de negocio (citas, clientas, servicios, horario, notas,
  premios…) pertenece a un estudio por `studioId`. Cada cuenta del panel es de un
  estudio y solo ve lo suyo. El estudio sale siempre de la sesión firmada
  (`src/lib/tenant.ts`), nunca de lo que mande el navegador.
  `src/lib/tenant-guard.test.ts` falla si una consulta de Prisma no filtra por estudio.
- **Sitio público** (`www`): es de un solo estudio, `PUBLIC_STUDIO_SLUG`
  (por defecto `tangible`), y solo si tiene `features.publicBooking`.
- **Funciones por estudio:** `features.rewards` enciende Premios/QR. iLoveMe lo
  tiene apagado.
- **Marca:** logo, íconos y pantallas de carga en `public/studios/<slug>/`,
  generados con `node scripts/brand/generate-studio-assets.mjs <slug> <logo>`.
- **Subdominio:** `src/proxy.ts`. En `admin.<dominio>` el panel vive en la raíz
  (`/calendar`). En cualquier otro host sigue bajo `/admin` (local, celular por
  IP, vistas previas de Vercel). Con `ADMIN_HOST` configurado, `www/admin` y
  `www/login` redirigen al subdominio.

## Despliegue (en este orden)

El código nuevo no puede leer documentos sin `studioId`, así que **la migración va
antes del despliegue**.

1. `npm run studios:migrate`: simulacro, revisa los números.
2. `npm run studios:migrate -- --apply`
   - Desde este momento Tania entra con **tania@tangible.com** (misma contraseña),
     también en la versión anterior que sigue en línea.
3. `npx prisma db push`: crea los índices nuevos (no toca datos).
4. Desplegar el código (merge a `main`).
5. `npm run studios:migrate -- --apply` otra vez: marca lo que la versión anterior
   haya creado entre los pasos 2 y 4.
6. `npm run users:create -- --email=alejandra@tangible.com --name=Alejandra --studio=iloveme`
   pide una contraseña **temporal** (sin mostrarla). La cuenta usa el panel
   normal desde el principio, con un aviso en el inicio hasta que elija la suya;
   al cambiarla, toda sesión abierta con la temporal en otros dispositivos se cierra.
   - ¿Olvidó su contraseña? `npm run users:create -- --email=<correo> --reset`
     pone una temporal nueva y cierra sus sesiones.

Antes de desplegar, `npm run db:backup` guarda un respaldo completo en
`scripts/.backups/` (no se sube a git).

### Subdominio

7. Vercel → Project → Settings → Domains: agregar `admin.studiotangible.com.mx`.
8. En el DNS del dominio: registro `CNAME` `admin` → el valor que indique Vercel
   (normalmente `cname.vercel-dns.com`).
9. Probar `https://admin.studiotangible.com.mx` (ya funciona sin más cambios).
10. Vercel → Environment Variables: `ADMIN_HOST=admin.studiotangible.com.mx` y
    redesplegar. A partir de aquí `studiotangible.com.mx/admin` redirige.
11. En los celulares: borrar la app vieja de la pantalla de inicio y volver a
    agregarla desde `https://admin.studiotangible.com.mx`. Cada una verá su ícono
    (Tangible o iLoveMe).

La sesión del panel vive en el subdominio: la primera vez hay que iniciar sesión
de nuevo ahí.

## Entrega

Enlaces de entrada (cada app instalada abre el suyo):

- Tania: `https://admin.studiotangible.com.mx/login?estudio=tangible`
- Alejandra: `https://admin.studiotangible.com.mx/login?estudio=iloveme`

**Tania**
1. Borra la app vieja de su pantalla de inicio.
2. Abre su enlace en Safari, entra con `tania@tangible.com` (su contraseña de siempre)
   y "Compartir → Agregar a pantalla de inicio".

**Alejandra**
1. Abre su enlace en Safari, entra con `alejandra@tangible.com` y la contraseña temporal.
2. "Compartir → Agregar a pantalla de inicio" (sale el ícono de iLoveMe).
3. Cambia su contraseña desde el aviso del inicio cuando quiera.

