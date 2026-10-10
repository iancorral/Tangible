import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PREFIX, isAdminHost } from "@/lib/admin-path";

/**
 * Enrutado por subdominio (Next 16: proxy, antes "middleware").
 *
 * admin.<dominio>: el panel se sirve en la raíz con direcciones limpias
 *   (/calendar → páginas de /admin/calendar). Un enlace viejo con /admin se
 *   redirige a su versión limpia.
 *
 * Cualquier otro host: el sitio público. Si ADMIN_HOST está configurado,
 *   /admin y /login se mandan al subdominio. Sin ADMIN_HOST (tu PC, el celular
 *   por IP, vistas previas de Vercel) el panel sigue funcionando bajo /admin.
 *
 * La autorización NO vive aquí: el layout del panel y cada API revisan la
 * sesión por su cuenta, así que un error en este archivo no abre nada.
 */

// Nunca se reescriben: APIs, login, archivos de Next y la marca/íconos.
const PASSTHROUGH = /^\/(?:api|_next|login|cambiar-contrasena|studios|icons|splash|fonts)(?:\/|$)/;

function isAdminPath(pathname: string) {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

function stripAdmin(pathname: string) {
  return pathname.slice(ADMIN_PREFIX.length) || "/";
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const { pathname } = request.nextUrl;

  if (isAdminHost(host)) {
    if (isAdminPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = stripAdmin(pathname);
      return NextResponse.redirect(url, 308);
    }
    if (PASSTHROUGH.test(pathname)) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? ADMIN_PREFIX : `${ADMIN_PREFIX}${pathname}`;
    return NextResponse.rewrite(url);
  }

  const adminHost = process.env.ADMIN_HOST?.trim().toLowerCase();
  const isAuthPage = pathname === "/login" || pathname === "/cambiar-contrasena";
  if (adminHost && isAdminHost(adminHost) && (isAdminPath(pathname) || isAuthPage)) {
    const target = new URL(request.nextUrl.toString());
    target.protocol = "https:";
    target.host = adminHost;
    target.port = "";
    target.pathname = isAuthPage ? pathname : stripAdmin(pathname);
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Todo menos archivos estáticos (cualquier ruta con extensión) e internos de Next.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
