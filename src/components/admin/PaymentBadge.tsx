type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";
type AppStatus = "CONFIRMED" | "CANCELLED";

interface Props {
  paymentStatus: PaymentStatus;
  appStatus: AppStatus;
  createdByAdmin?: boolean;
  paymentMethod?: string | null;
  /** Courtesy appointment: there is nothing to collect and no method applies. */
  isFree?: boolean;
}

const PAYMENT_CONFIG = {
  PENDING: {
    label: "Pendiente",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  PARTIAL: {
    label: "Anticipo",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-400",
  },
  PAID: {
    label: "Pagado",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
  },
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

export default function PaymentBadge({ paymentStatus, appStatus, createdByAdmin, paymentMethod, isFree }: Props) {
  if (appStatus === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider bg-gray-50 text-gray-400 border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        Cancelada
      </span>
    );
  }

  const config = PAYMENT_CONFIG[paymentStatus] ?? PAYMENT_CONFIG.PENDING;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isFree ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider bg-salon-lavender/10 text-salon-lavender border-salon-lavender/30">
          <span className="w-1.5 h-1.5 rounded-full bg-salon-lavender" />
          Sin cobro
        </span>
      ) : (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.text} ${config.border}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
          {paymentStatus === "PAID" && paymentMethod && METHOD_LABELS[paymentMethod]
            ? ` · ${METHOD_LABELS[paymentMethod]}`
            : ""}
        </span>
      )}
      {/* Casi todas las citas las agenda la dueña; marcar esas era ruido.
          Lo que vale la pena notar es la excepción: una reserva de la web. */}
      {createdByAdmin === false && (
        <span className="inline-flex items-center px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider bg-salon-olive/10 text-salon-olive border-salon-olive/30">
          Web
        </span>
      )}
    </div>
  );
}

export { METHOD_LABELS, PAYMENT_CONFIG };