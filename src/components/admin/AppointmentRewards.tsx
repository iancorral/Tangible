"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Blocker = "NO_CUSTOMER" | "CANCELLED" | "FREE" | "REDEEMED";

type State = {
  program: { isActive: boolean; stampsRequired: number; rewardLabel: string };
  customer: { id: string; name: string } | null;
  stamps: number;
  ready: boolean;
  stampGranted: boolean;
  redemption: { amountApplied: number | null; rewardLabel: string } | null;
  previewDiscount: number;
  blocker: Blocker | null;
  canGrant: boolean;
  enrolled: boolean;
};

/** The plaintext code, held in memory only for as long as it is on screen. */
type IssuedCode = { code: string; expiresAt: string };

interface Props {
  appointmentId: string;
  /** Kept in step so saving the payment form does not undo the discount. */
  onFinalPriceChange: (finalPrice: number) => void;
}

const BLOCKER_NOTES: Record<Blocker, string> = {
  NO_CUSTOMER: "Esta cita no tiene teléfono. Agrégalo en la cita para poder sellar.",
  CANCELLED: "Las citas canceladas no dan sello.",
  FREE: "Las citas gratis cuentan como cita, pero no dan sello.",
  REDEEMED: "Esta cita aplicó una recompensa, así que no da sello.",
};

/**
 * Loyalty controls inside the checkout sheet. Deliberately self-contained: it
 * talks to the rewards endpoints only, so the payment form above it keeps
 * exactly the behaviour it had before rewards existed.
 */
export default function AppointmentRewards({ appointmentId, onFinalPriceChange }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);

  const issueCode = useCallback(async () => {
    if (!state?.customer) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rewards/claim-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: state.customer.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo generar el código");
        return;
      }
      setIssued({ code: data.code, expiresAt: data.expiresAt });
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/rewards/appointment?appointmentId=${appointmentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const toggleStamp = useCallback(async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rewards/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          action: state.stampGranted ? "REVOKE" : "GRANT",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo actualizar el sello");
        return;
      }
      setState(data);
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }, [appointmentId, state]);

  const redeem = useCallback(async () => {
    if (!state?.customer) return;
    if (!window.confirm(`¿Aplicar la recompensa de ${state.customer.name} a esta cita?`)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: state.customer.id, appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo canjear");
        return;
      }
      // The server already wrote finalPrice; push it into the payment form so a
      // later Guardar does not overwrite the discount with a stale value.
      if (typeof data.finalPrice === "number") onFinalPriceChange(data.finalPrice);

      const refreshed = await fetch(
        `/api/admin/rewards/appointment?appointmentId=${appointmentId}`
      );
      if (refreshed.ok) setState(await refreshed.json());
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }, [appointmentId, state, onFinalPriceChange]);

  // Nothing to say until the program is switched on.
  if (!state || !state.program.isActive) return null;

  const { program, stamps, stampGranted, redemption, blocker } = state;

  return (
    <div className="bg-salon-honey/10 border-2 border-salon-honey/50 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-black text-salon-brown uppercase tracking-widest">
          Recompensas
        </p>
        {state.customer && (
          <span className="text-[10px] font-black text-salon-gray tabular-nums">
            {stamps} / {program.stampsRequired} sellos
          </span>
        )}
      </div>

      {blocker === "NO_CUSTOMER" ? (
        <p className="text-[10px] text-salon-terracotta font-bold leading-relaxed">
          {BLOCKER_NOTES.NO_CUSTOMER}
        </p>
      ) : (
        <>
          <div
            className="flex items-center gap-1 mb-2.5"
            role="img"
            aria-label={`${stamps} de ${program.stampsRequired} sellos`}
          >
            {Array.from({ length: program.stampsRequired }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full ${
                  i < stamps ? "bg-salon-brown" : "bg-salon-brown/15"
                }`}
              />
            ))}
          </div>

          {redemption ? (
            <p className="text-[11px] font-bold text-salon-olive leading-relaxed">
              Recompensa aplicada
              {redemption.amountApplied != null && (
                <> · −{formatCurrency(redemption.amountApplied)}</>
              )}
            </p>
          ) : (
            <>
              {blocker ? (
                <p className="text-[10px] text-salon-gray font-medium leading-relaxed">
                  {BLOCKER_NOTES[blocker]}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={toggleStamp}
                  disabled={busy}
                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 ${
                    stampGranted
                      ? "bg-white text-salon-gray border-2 border-salon-gray/25 hover:border-salon-terracotta hover:text-salon-terracotta"
                      : "bg-salon-brown text-salon-honey hover:bg-salon-brown/90"
                  }`}
                >
                  {stampGranted ? "Quitar el sello de esta cita" : "Dar sello por esta cita"}
                </button>
              )}

              {state.ready && !stampGranted && !blocker && (
                <button
                  type="button"
                  onClick={redeem}
                  disabled={busy}
                  className="w-full mt-2 py-2.5 rounded-xl bg-salon-terracotta text-white text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
                >
                  Canjear recompensa · −{formatCurrency(state.previewDiscount)}
                </button>
              )}

              {state.ready && stampGranted && (
                <p className="text-[10px] text-salon-gray font-medium mt-2 leading-relaxed">
                  Tiene la tarjeta llena. Quita el sello de esta cita para poder canjear
                  aquí mismo.
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* Activación de la tarjeta digital.
          Se puede volver a generar un código aunque ya esté activada: cambia de
          teléfono, borra cookies, o simplemente no alcanzó a escribirlo. */}
      {state.customer && (
        <div className="mt-3 pt-3 border-t border-salon-brown/10">
          {issued ? (
            <>
              <p className="text-[10px] font-black text-salon-gray uppercase tracking-widest mb-1.5">
                Código para activar su tarjeta
              </p>
              <p className="text-center text-3xl font-black text-salon-brown tracking-[0.16em] tabular-nums bg-salon-honey/30 rounded-xl py-3">
                {issued.code}
              </p>
              <p className="text-[10px] text-salon-gray text-center mt-1.5 leading-relaxed">
                Un solo uso · vence a las{" "}
                <span className="font-bold text-salon-brown">
                  {new Date(issued.expiresAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                . Que lo escriba acercando su teléfono al sticker de recompensas.
              </p>
              <button
                type="button"
                onClick={issueCode}
                disabled={busy}
                className="w-full mt-2 text-[10px] font-black uppercase tracking-widest text-salon-gray hover:text-salon-brown disabled:opacity-40"
              >
                Generar otro código
              </button>
            </>
          ) : (
            <>
              {state.enrolled && (
                <p className="text-[10px] text-salon-olive font-bold mb-2 text-center">
                  Ya tiene su tarjeta activada
                </p>
              )}
              <button
                type="button"
                onClick={issueCode}
                disabled={busy}
                className="w-full py-2.5 rounded-xl border-2 border-salon-brown/25 text-salon-brown text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-salon-brown/5 disabled:opacity-40"
              >
                {state.enrolled ? "Activar en otro teléfono" : "Activar su tarjeta digital"}
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[10px] text-salon-terracotta font-bold mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
