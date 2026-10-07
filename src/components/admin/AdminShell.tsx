"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { usePrivacy } from "@/components/privacy";
import { useAdminHref, useStudio } from "@/components/admin/StudioContext";
import { rememberStudio } from "@/lib/studio-hint";
import StudioMark from "@/components/brand/StudioMark";
import { wordmarkClass } from "@/lib/studio-brand";

/**
 * Navegación del panel.
 *
 * - Escritorio (lg+): barra lateral fija, como las herramientas de agenda que
 *   se usan en mostrador (Fresha, Square). Todo a un clic, sin "volver".
 * - Celular: barra de pestañas inferior al estilo iOS con las cuatro secciones
 *   de uso diario; lo demás vive en "Más". Respeta la barra de inicio del
 *   iPhone con env(safe-area-inset-bottom).
 */

type IconName =
  | "home" | "calendar" | "users" | "note" | "more" | "cash"
  | "award" | "qr" | "clock" | "eye" | "eyeOff" | "logout" | "globe" | "key";

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  note: <><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z" /><path d="M15 3v6h6M7 13h6M7 17h10" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  award: <><circle cx="12" cy="8" r="6" /><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 18h.01M18 14h3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
};

function Icon({ name, className = "w-5 h-5" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: IconName };

const PRIMARY: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/calendar", label: "Agenda", icon: "calendar" },
  { href: "/customers", label: "Clientas", icon: "users" },
  { href: "/notes", label: "Notas", icon: "note" },
];

type BusinessItem = NavItem & { requires?: "rewards" };

const BUSINESS_ITEMS: BusinessItem[] = [
  { href: "/revenue", label: "Ingresos", icon: "cash" },
  { href: "/rewards", label: "Premios", icon: "award", requires: "rewards" },
  { href: "/qr", label: "QR de tarjeta", icon: "qr", requires: "rewards" },
  { href: "/schedule", label: "Horario", icon: "clock" },
];

// Sitio público de reservas (solo el estudio que tiene publicBooking).
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "/";

/** `href` ya armado con la base (p. ej. "/calendar" o "/admin/calendar"). */
function isActive(pathname: string, href: string, homeHref: string) {
  return href === homeHref ? pathname === homeHref : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hidden, toggle } = usePrivacy();
  const studio = useStudio();
  const adminPath = useAdminHref();
  const home = adminPath("/");
  const withBase = <T extends NavItem>(items: T[]) => items.map((item) => ({ ...item, href: adminPath(item.href) }));
  const PRIMARY_NAV = withBase(PRIMARY);
  // Solo las secciones que este estudio tiene encendidas (iLoveMe: sin Premios/QR).
  const BUSINESS = withBase(BUSINESS_ITEMS.filter((item) => !item.requires || studio.features[item.requires]));
  const active = (href: string) => isActive(pathname, href, home);
  const [moreOpen, setMoreOpen] = useState(false);

  // Cambiar de pantalla cierra la hoja "Más".
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
  }

  // Para que el login muestre este logo la próxima vez (ver lib/studio-hint.ts).
  useEffect(() => {
    rememberStudio(studio.slug);
  }, [studio.slug]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const logout = async () => {
    // redirect:false + navegación propia: así el destino no depende de
    // NEXTAUTH_URL (que en local puede apuntar a producción).
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  };

  const moreActive = BUSINESS.some((item) => active(item.href));

  return (
    <div className="min-h-[100dvh]">
      {/* ── Barra lateral (escritorio) ───────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-salon-brown/[0.07] bg-[#FCFAF7]/90 backdrop-blur-xl">
        {/* Marca del estudio: logo en círculo + nombre, como el "espacio de
            trabajo" de Notion o Linear. */}
        <Link href={home} className="mx-3 mt-5 mb-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-salon-brown/[0.03]">
          <StudioMark slug={studio.slug} name={studio.name} size={42} />
          <span className="min-w-0">
            <span className={`block truncate text-[15px] font-black text-salon-brown ${wordmarkClass(studio.slug)}`}>
              {studio.shortName}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-salon-terracotta/90">Panel</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Panel">
          <SideGroup items={PRIMARY_NAV} isActive={active} />
          <p className="mt-6 mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-salon-gray/70">Negocio</p>
          <SideGroup items={BUSINESS} isActive={active} />
        </nav>

        <div className="border-t border-salon-brown/[0.07] p-3">
          <AccountMenu
            firstName={studio.firstName}
            email={studio.email}
            hidden={hidden}
            onTogglePrivacy={toggle}
            publicSiteUrl={studio.features.publicBooking ? PUBLIC_SITE_URL : null}
            onLogout={logout}
          />
        </div>
      </aside>

      {/* ── Contenido ────────────────────────────────────────────────── */}
      <div className="lg:pl-64 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>

      {/* ── Pestañas (celular) ───────────────────────────────────────── */}
      <nav
        aria-label="Panel"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-salon-brown/10 bg-white/85 backdrop-blur-xl pb-safe"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <TabLink item={item} active={active(item.href)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={tabClass(moreActive || moreOpen)}
            >
              <Icon name="more" className="w-6 h-6" />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── Hoja "Más" (celular) ─────────────────────────────────────── */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full rounded-t-[28px] bg-salon-bg shadow-2xl pb-safe animate-[sheetUp_220ms_ease-out]">
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-salon-brown/15" aria-hidden="true" />
            <div className="p-4 space-y-3">
              <ul className="overflow-hidden rounded-2xl bg-white divide-y divide-salon-brown/5">
                {BUSINESS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={sheetRowClass(active(item.href))}>
                      <Icon name={item.icon} className="w-5 h-5 text-salon-terracotta" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-salon-gray/50" aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="overflow-hidden rounded-2xl bg-white divide-y divide-salon-brown/5">
                <li>
                  <button type="button" onClick={toggle} className={sheetRowClass(false)}>
                    <Icon name={hidden ? "eyeOff" : "eye"} className="w-5 h-5 text-salon-olive" />
                    <span className="flex-1 text-left">Ocultar montos</span>
                    <span
                      className={`relative h-[26px] w-[44px] rounded-full transition-colors ${hidden ? "bg-salon-olive" : "bg-salon-gray/30"}`}
                      aria-hidden="true"
                    >
                      <span className={`absolute top-0.5 left-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-transform ${hidden ? "translate-x-[18px]" : ""}`} />
                    </span>
                  </button>
                </li>
                {studio.features.publicBooking && (
                  <li>
                    <a href={PUBLIC_SITE_URL} target="_blank" rel="noopener noreferrer" className={sheetRowClass(false)}>
                      <Icon name="globe" className="w-5 h-5 text-salon-gray" />
                      <span className="flex-1">Ver sitio de reservas</span>
                    </a>
                  </li>
                )}
              </ul>
              <ul className="overflow-hidden rounded-2xl bg-white">
                <li>
                  <Link href="/cambiar-contrasena" className={sheetRowClass(false)}>
                    <Icon name="key" className="w-5 h-5 text-salon-gray" />
                    <span className="flex-1">Cambiar contraseña</span>
                    <span className="text-salon-gray/50" aria-hidden="true">›</span>
                  </Link>
                </li>
              </ul>
              <button type="button" onClick={logout} className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-bold text-salon-terracotta active:bg-salon-terracotta/5">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sideItemClass(active: boolean) {
  return `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-bold transition-all ${
    active
      ? "bg-white text-salon-brown shadow-[0_1px_3px_rgba(44,31,14,0.08)] ring-1 ring-salon-brown/[0.06]"
      : "text-salon-brown/65 hover:bg-salon-brown/[0.035] hover:text-salon-brown"
  }`;
}

function SideGroup({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={active ? "page" : undefined} className={sideItemClass(active)}>
              <Icon
                name={item.icon}
                className={`h-[18px] w-[18px] transition-colors ${active ? "text-salon-terracotta" : "text-salon-brown/45 group-hover:text-salon-brown/70"}`}
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Cuenta de quien inició sesión, abajo de la barra. Las acciones de cuenta
 * (privacidad, contraseña, salir) viven en un menú en lugar de ocupar cuatro
 * renglones fijos que competían con la navegación.
 */
function AccountMenu({
  firstName,
  email,
  hidden,
  onTogglePrivacy,
  publicSiteUrl,
  onLogout,
}: {
  firstName: string;
  email: string;
  hidden: boolean;
  onTogglePrivacy: () => void;
  publicSiteUrl: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-bold text-salon-brown/80 hover:bg-salon-brown/[0.04] hover:text-salon-brown";

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div role="menu" aria-label="Tu cuenta" className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-salon-brown/[0.08] bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(44,31,14,0.3)]">
          <button type="button" role="menuitemcheckbox" aria-checked={hidden} onClick={onTogglePrivacy} className={item}>
            <Icon name={hidden ? "eyeOff" : "eye"} className="h-[18px] w-[18px] text-salon-brown/50" />
            <span className="flex-1">Ocultar montos</span>
            <span aria-hidden="true" className={`relative h-5 w-8 rounded-full transition-colors ${hidden ? "bg-salon-olive" : "bg-salon-gray/25"}`}>
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hidden ? "translate-x-3" : ""}`} />
            </span>
          </button>
          {publicSiteUrl && (
            <a role="menuitem" href={publicSiteUrl} target="_blank" rel="noopener noreferrer" className={item}>
              <Icon name="globe" className="h-[18px] w-[18px] text-salon-brown/50" />
              Ver sitio de reservas
            </a>
          )}
          <Link role="menuitem" href="/cambiar-contrasena" className={item}>
            <Icon name="key" className="h-[18px] w-[18px] text-salon-brown/50" />
            Cambiar contraseña
          </Link>
          <div className="my-1 h-px bg-salon-brown/[0.06]" />
          <button type="button" role="menuitem" onClick={onLogout} className={`${item} text-salon-terracotta hover:text-salon-terracotta`}>
            <Icon name="logout" className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-salon-brown/[0.035] ${open ? "bg-salon-brown/[0.035]" : ""}`}
      >
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-salon-blush/60 text-sm font-black text-salon-brown">
          {firstName.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-salon-brown">{firstName}</span>
          <span className="block truncate text-[11px] text-salon-gray">{email}</span>
        </span>
        {hidden && <Icon name="eyeOff" className="h-4 w-4 shrink-0 text-salon-olive" />}
        <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-salon-brown/40 transition-transform ${open ? "" : "rotate-180"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

function tabClass(active: boolean) {
  return `flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-bold tracking-wide transition-colors ${
    active ? "text-salon-terracotta" : "text-salon-gray"
  }`;
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <Icon name={item.icon} className="w-6 h-6" />
      <span>{item.label}</span>
    </Link>
  );
}

function sheetRowClass(active: boolean) {
  return `flex w-full items-center gap-3 px-4 py-3.5 text-[15px] font-bold text-salon-brown active:bg-salon-brown/5 ${
    active ? "bg-salon-blush/20" : ""
  }`;
}
