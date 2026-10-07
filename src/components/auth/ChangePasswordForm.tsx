"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import MuralDecorations from "@/components/layout/MuralDecorations";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

interface Props {
  /** Sigue con la contraseña temporal (cambia el texto, no bloquea nada). */
  forced: boolean;
  firstName: string;
  email: string;
  brand: { name: string; shortName: string; logoPath: string | null };
  /** A dónde volver si el cambio es voluntario. */
  backHref: string;
}

const inputClass =
  "w-full bg-white border-2 border-salon-gray/30 px-4 py-3 text-salon-brown focus:border-salon-lavender focus:ring-0 outline-none transition-all hand-drawn placeholder:text-salon-gray/40 font-medium";
const labelClass = "block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2";

export default function ChangePasswordForm({ forced, firstName, email, brand, backHref }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      current: String(form.get("current") ?? ""),
      next: String(form.get("next") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    };
    if (body.next.length < PASSWORD_MIN_LENGTH) {
      setError(`La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
      return;
    }
    if (body.next !== body.confirm) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setSaving(true);
    let res: Response;
    try {
      res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("No hay conexión. Revisa tu internet y vuelve a intentarlo.");
      setSaving(false);
      return;
    }

    if (!res.ok) {
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cambiar la contraseña.");
      setSaving(false);
      return;
    }

    // El cambio cierra las sesiones abiertas con la contraseña anterior (en
    // otros dispositivos). Esta se renueva sola con la nueva para no sacarla.
    const renewed = await signIn("credentials", { email, password: body.next, redirect: false });
    router.replace(renewed?.ok ? backHref : "/login?cambiada=1");
    router.refresh();
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-salon-bg p-6 relative">
      <MuralDecorations />
      <div className="relative z-10 w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-3xl border-2 border-salon-olive/30 shadow-folk p-8 hand-drawn">
        <div className="text-center mb-6">
          {brand.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo estático pequeño de /public
            <img src={brand.logoPath} alt={brand.name} className="mx-auto h-20 w-auto" />
          ) : (
            <p className="font-title text-2xl font-black text-salon-brown tracking-[0.3em] uppercase">{brand.shortName}</p>
          )}
          <h1 className="mt-4 text-lg font-black text-salon-brown">
            {forced ? `Hola, ${firstName}` : "Cambiar contraseña"}
          </h1>
          <p className="mt-1 text-xs text-salon-gray leading-relaxed">
            {forced
              ? "Estás usando una contraseña temporal. Elige una tuya para que tu panel sea privado: solo tú la sabrás."
              : "Al guardarla se cerrarán las sesiones abiertas en otros dispositivos."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current" className={labelClass}>
              {forced ? "Contraseña temporal" : "Contraseña actual"}
            </label>
            <input id="current" name="current" type="password" required autoComplete="current-password" className={inputClass} />
          </div>
          <div>
            <label htmlFor="next" className={labelClass}>Nueva contraseña</label>
            <input
              id="next"
              name="next"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className={inputClass}
              placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
            />
          </div>
          <div>
            <label htmlFor="confirm" className={labelClass}>Repite la nueva</label>
            <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 font-bold text-center bg-red-50 py-2 px-3 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-2 bg-salon-brown text-salon-blush py-4 px-6 font-black text-sm uppercase tracking-widest shadow-folk active:scale-[0.98] transition-all disabled:opacity-50 hand-drawn border-2 border-salon-brown hover:bg-salon-brown/90 rounded-xl"
          >
            {saving ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>

        <Link href={backHref} className="mt-5 block text-center text-[11px] font-bold uppercase tracking-wider text-salon-gray hover:text-salon-brown">
          {forced ? "Ahora no, volver al panel" : "← Volver al panel"}
        </Link>
      </div>
    </main>
  );
}
