import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const req = (url: string) => new NextRequest(new URL(url), { headers: { host: new URL(url).host } });

afterEach(() => vi.unstubAllEnvs());

describe("proxy: subdominio admin", () => {
  it("sirve el panel en la raíz del subdominio", () => {
    const res = proxy(req("https://admin.studiotangible.com.mx/"));
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://admin.studiotangible.com.mx/admin");
  });

  it("direcciones limpias: /calendar es la agenda del panel", () => {
    const res = proxy(req("https://admin.studiotangible.com.mx/calendar?date=2026-10-06"));
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://admin.studiotangible.com.mx/admin/calendar?date=2026-10-06");
  });

  it("un enlace viejo con /admin se redirige a la versión limpia", () => {
    const res = proxy(req("https://admin.studiotangible.com.mx/admin/notes"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://admin.studiotangible.com.mx/notes");
  });

  it.each(["/api/admin/notes", "/login", "/studios/iloveme/logo.png", "/icons/icon-192.png"])(
    "no toca %s",
    (path) => {
      const res = proxy(req(`https://admin.studiotangible.com.mx${path}`));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      expect(res.headers.get("location")).toBeNull();
    }
  );
});

describe("proxy: sitio público", () => {
  it("sin ADMIN_HOST el panel sigue bajo /admin (PC, celular por IP, vistas previas)", () => {
    const res = proxy(req("http://192.168.1.72:3000/admin/calendar"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("con ADMIN_HOST, /admin y /login se mudan al subdominio", () => {
    vi.stubEnv("ADMIN_HOST", "admin.studiotangible.com.mx");
    const a = proxy(req("https://www.studiotangible.com.mx/admin/calendar?date=2026-10-06"));
    expect(a.status).toBe(308);
    expect(a.headers.get("location")).toBe("https://admin.studiotangible.com.mx/calendar?date=2026-10-06");

    const b = proxy(req("https://studiotangible.com.mx/login"));
    expect(b.headers.get("location")).toBe("https://admin.studiotangible.com.mx/login");

    // El enlace propio de cada estudio conserva su ?estudio= al mudarse.
    const c = proxy(req("https://www.studiotangible.com.mx/login?estudio=iloveme"));
    expect(c.headers.get("location")).toBe("https://admin.studiotangible.com.mx/login?estudio=iloveme");
  });

  it("las páginas públicas no se tocan", () => {
    vi.stubEnv("ADMIN_HOST", "admin.studiotangible.com.mx");
    for (const path of ["/", "/rewards", "/review"]) {
      const res = proxy(req(`https://www.studiotangible.com.mx${path}`));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("ignora un ADMIN_HOST que no sea un subdominio admin (evita redirecciones raras)", () => {
    vi.stubEnv("ADMIN_HOST", "evil.example.com");
    const res = proxy(req("https://www.studiotangible.com.mx/admin"));
    expect(res.headers.get("location")).toBeNull();
  });
});
