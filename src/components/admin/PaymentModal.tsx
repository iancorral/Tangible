"use client";

import { useCallback, useState } from "react";
import AppointmentRewards from "./AppointmentRewards";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Props {
  appointmentId: string;
  clientName: string;
  currentPaymentStatus: PaymentStatus;
  currentPaymentMethod?: string | null;
  currentFinalPrice?: number | null;
  currentDepositPaid?: boolean;
  currentDepositAmount?: number | null;
  services: Service[];
  onClose: () => void;
  onUpdated: (data: {
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod | null;
    finalPrice?: number | null;
    depositPaid?: boolean;
    depositAmount?: number | null;
  }) => void;
}

const basePrice = (services: Service[]) =>
  services.reduce((a, s) => a + s.price, 0);

/** Empty or unparseable input means "no override", not zero. */
const parseAmount = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function PaymentModal({
  appointmentId,
  clientName,
  currentPaymentStatus,
  currentPaymentMethod,
  currentFinalPrice,
  currentDepositPaid,
  currentDepositAmount,
  services,
  onClose,
  onUpdated,
}: Props) {
  useBodyScrollLock();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(currentPaymentStatus);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    (currentPaymentMethod as PaymentMethod) ?? ""
  );
  const [finalPrice, setFinalPrice] = useState(
    currentFinalPrice != null ? String(currentFinalPrice) : ""
  );
  const [depositPaid, setDepositPaid] = useState(currentDepositPaid ?? false);
  const [depositAmount, setDepositAmount] = useState(
    currentDepositAmount != null ? String(currentDepositAmount) : ""
  );
  // A courtesy appointment is stored as an explicit final price of 0, which is
  // what keeps it out of revenue while still counting as an appointment.
  const [isFree, setIsFree] = useState(
    currentFinalPrice != null && Number(currentFinalPrice) === 0
  );
  const [saving, setSaving] = useState(false);

  const base = basePrice(services);

  // Redeeming a reward writes the discounted price server-side; mirroring it
  // here keeps the form honest, so pressing Guardar afterwards saves the
  // discount instead of overwriting it with what was on screen before.
  const applyRewardPrice = useCallback((next: number) => {
    setFinalPrice(String(next));
  }, []);

  const toggleFree = () => {
    const next = !isFree;
    setIsFree(next);
    // Leaving free mode drops the $0 override so the price falls back to the
    // service catalog until the admin enters another one.
    if (!next && parseAmount(finalPrice) === 0) setFinalPrice("");
  };

  const handleSave = async () => {
    setSaving(true);

    // Free appointments settle to a fixed shape: no charge, no method, no deposit.
    const changes = isFree
      ? {
          paymentStatus: "PAID" as PaymentStatus,
          paymentMethod: null,
          finalPrice: 0,
          depositPaid: false,
          depositAmount: null,
        }
      : {
          paymentStatus,
          paymentMethod: paymentMethod || null,
          finalPrice: parseAmount(finalPrice),
          depositPaid,
          depositAmount: parseAmount(depositAmount),
        };

    const res = await fetch(`/api/admin/appointments/${appointmentId}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });

    if (res.ok) {
      onUpdated(changes);
      onClose();
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 my-auto bg-white w-full max-w-sm rounded-3xl border-2 border-salon-olive/20 shadow-xl p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="font-black text-salon-brown uppercase tracking-wider">
              Registro de Pago
            </h3>
            <p className="text-[10px] text-salon-gray uppercase tracking-widest mt-0.5">
              {clientName}
            </p>
          </div>
          <button onClick={onClose} className="text-salon-gray hover:text-salon-brown font-bold text-xl">
            ✕
          </button>
        </div>

        <div className="space-y-4">

          {/* Cita gratis — cuenta como cita, nunca como ingreso */}
          <div className="flex items-center justify-between gap-3 bg-salon-lavender/10 border-2 border-salon-lavender/30 rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-salon-lavender uppercase tracking-widest">
                Cita gratis
              </p>
              <p className="text-[10px] text-salon-gray font-medium mt-0.5">
                Cortesía o cambio de trabajo: no requiere método de pago.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isFree}
              aria-label="Marcar la cita como gratis"
              onClick={toggleFree}
              className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${
                isFree ? "bg-salon-lavender" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  isFree ? "left-5" : "left-1"
                }`}
              />
            </button>
          </div>

          {isFree ? (
            <p className="text-[11px] text-salon-gray font-medium bg-salon-bg border border-salon-olive/15 rounded-2xl px-4 py-3">
              Se guardará con precio $0 y sin método de pago. Seguirá contando como
              cita y aparecerá en la sección{" "}
              <span className="font-black text-salon-lavender">Gratis</span> del
              desglose de ingresos.
            </p>
          ) : (
            <>

              {/* Estado de pago */}
              <div>
                <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
                  Estado
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PENDING", "PARTIAL", "PAID"] as PaymentStatus[]).map((s) => {
                    const labels = {
                      PENDING: "Pendiente",
                      PARTIAL: "Anticipo",
                      PAID: "Pagado",
                    };
                    const colors = {
                      PENDING: paymentStatus === s
                        ? "bg-salon-terracotta text-white border-salon-terracotta"
                        : "bg-white text-salon-terracotta border-salon-terracotta/25",
                      PARTIAL: paymentStatus === s
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-blue-600 border-blue-200",
                      PAID: paymentStatus === s
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-white text-green-600 border-green-200",
                    };
                    return (
                      <button
                        key={s}
                        onClick={() => setPaymentStatus(s)}
                        className={`py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${colors[s]}`}
                      >
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
                  Método
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((m) => {
                    const labels = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transfer" };
                    return (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m === paymentMethod ? "" : m)}
                        className={`py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                          paymentMethod === m
                            ? "bg-salon-olive text-white border-salon-olive"
                            : "bg-white text-salon-gray border-salon-gray/20 hover:border-salon-olive/40"
                        }`}
                      >
                        {labels[m]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
                    Anticipo ($)
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="150"
                    className="w-full border-2 border-salon-gray/30 rounded-xl px-3 py-2.5 text-salon-brown font-medium focus:border-salon-olive outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label
                    onClick={() => setDepositPaid(!depositPaid)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div
                      className={`w-10 h-6 rounded-full transition-all relative ${
                        depositPaid ? "bg-salon-olive" : "bg-gray-200"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          depositPaid ? "left-5" : "left-1"
                        }`}
                      />
                    </div>
                    <span className="text-xs font-bold text-salon-brown">
                      {depositPaid ? "Pagado" : "Pendiente"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Precio final */}
              <div>
                <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
                  Precio final (base: ${base})
                </label>
                <input
                  type="number"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  placeholder={`${base} (dejar vacío = precio base)`}
                  className="w-full border-2 border-salon-gray/30 rounded-xl px-3 py-2.5 text-salon-brown font-medium focus:border-salon-olive outline-none"
                />
                <p className="text-[10px] text-salon-gray mt-1">
                  Ajusta si el diseño fue más complejo o hubo descuento.
                </p>
              </div>

            </>
          )}

          <AppointmentRewards
            appointmentId={appointmentId}
            onFinalPriceChange={applyRewardPrice}
          />

        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-5 py-3 bg-salon-brown text-salon-blush font-black text-xs uppercase tracking-widest rounded-2xl disabled:opacity-40 hover:bg-salon-brown/90 transition-all"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}