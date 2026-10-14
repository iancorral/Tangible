import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PASS_COOKIE, readDevicePass } from "@/lib/rewards-access";
import { getRewardProgram, getStampBalance } from "@/lib/rewards.server";
import { getPublicStudio, hasFeature } from "@/lib/tenant";
import { notFound } from "next/navigation";
import EnrollForm from "@/components/rewards/EnrollForm";
import RewardCoupon from "@/components/rewards/RewardCoupon";
import { formatChihuahuaDate } from "@/lib/timezone";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi tarjeta · Tangible",
  description: "Tus sellos y recompensas en Tangible Nails & Art Studio.",
  // A personal loyalty card has no business in a search index.
  robots: { index: false, follow: false },
};

// Reads a cookie and a live balance, so it must never be cached or prerendered.
export const dynamic = "force-dynamic";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Shown on a phone that may be handed around or left on a counter, so the card
 * says who it belongs to without spelling her out: "Ana G.", never the full name.
 */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest[0]?.[0];
  return initial ? `${first} ${initial}.` : first;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-salon-bg px-6 py-10">
      <div className="max-w-sm mx-auto">
        <header className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 relative mb-2">
            <Image
              src="/logo-tangible.png"
              alt=""
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-title text-2xl font-black text-salon-brown tracking-[0.3em] uppercase">
            Tangible
          </h1>
          <div className="flex items-center gap-3 opacity-70 mt-1">
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full" />
            <p className="text-salon-terracotta text-[10px] uppercase tracking-[0.2em] font-bold">
              Nails &amp; Art Studio
            </p>
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full" />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  // Código que trae el QR de activación del panel (un solo uso, 30 minutos).
  const { code: qrCode } = await searchParams;
  // La tarjeta pública es del estudio dueño del sitio (Tangible).
  const studio = await getPublicStudio();
  if (!studio || !hasFeature(studio, "rewards")) notFound();
  const studioId = studio.id;

  const program = await getRewardProgram(studioId);

  if (!program.isActive) {
    return (
      <Shell>
        <div className="bg-white border-2 border-salon-olive/20 rounded-3xl p-8 text-center">
          <p className="text-sm font-black text-salon-brown uppercase tracking-wide mb-2">
            Muy pronto
          </p>
          <p className="text-xs text-salon-gray leading-relaxed">
            Estamos preparando el programa de recompensas. Pregunta en el estudio.
          </p>
        </div>
      </Shell>
    );
  }

  // Identity comes only from the signed cookie. There is no query parameter and
  // no id in the URL, so there is nothing to change to see somebody else's card.
  const store = await cookies();
  const customerId = readDevicePass(store.get(PASS_COOKIE)?.value);

  if (!customerId) {
    return (
      <Shell>
        <div className="mb-6">
          <RewardCoupon
            stamps={0}
            required={program.stampsRequired}
            rewardLabel={program.rewardLabel}
            termsNote={program.termsNote}
            preview
          />
        </div>

        <p className="text-sm font-black text-salon-brown text-center mb-1">
          {qrCode ? "Activando tu tarjeta…" : "Activa tu tarjeta"}
        </p>
        <p className="text-xs text-salon-gray text-center leading-relaxed mb-5">
          {qrCode
            ? "Un segundo, la estamos dejando lista en este celular."
            : "Escribe el código que te damos en el estudio, o escanea el QR que te mostramos."}
        </p>

        <EnrollForm initialCode={qrCode} />

        <p className="text-[10px] text-salon-gray/80 text-center leading-relaxed mt-4">
          Solo la primera vez. Después tu tarjeta se abre sola en este teléfono.
        </p>
      </Shell>
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId, studioId },
    select: { name: true, joinedAt: true },
  });

  // The pass outlived its customer — a merged or deleted record. Send her back
  // to enrollment rather than showing an error she cannot act on.
  if (!customer) {
    return (
      <Shell>
        <div className="bg-white border-2 border-salon-olive/20 rounded-3xl p-6 mb-5">
          <p className="text-xs text-salon-gray text-center leading-relaxed">
            No encontramos tu tarjeta. Pide un código nuevo en el estudio para
            activarla otra vez.
          </p>
        </div>
        <EnrollForm />
      </Shell>
    );
  }

  const stamps = await getStampBalance(studioId, customerId);
  const required = program.stampsRequired;

  const lastRedemption = await prisma.redemption.findFirst({
    where: { studioId, customerId },
    orderBy: { redeemedAt: "desc" },
    select: { rewardLabel: true, redeemedAt: true },
  });

  return (
    <Shell>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-lg font-black text-salon-brown">
          Hola, {shortName(customer.name)}
        </p>
        {customer.joinedAt && (
          <p className="text-[10px] text-salon-gray font-bold shrink-0">
            desde {MONTHS[customer.joinedAt.getMonth()]} {customer.joinedAt.getFullYear()}
          </p>
        )}
      </div>

      <div className="mb-6">
        <RewardCoupon
          stamps={stamps}
          required={required}
          rewardLabel={program.rewardLabel}
          termsNote={program.termsNote}
        />
      </div>

      {lastRedemption && (
        <section className="bg-salon-olive/5 border-2 border-salon-olive/30 rounded-2xl px-5 py-4 mb-5">
          <p className="text-[10px] font-black text-salon-olive uppercase tracking-widest mb-1">
            Última recompensa
          </p>
          <p className="text-xs text-salon-brown font-bold">{lastRedemption.rewardLabel}</p>
          <p className="text-[10px] text-salon-gray mt-0.5">
            {formatChihuahuaDate(lastRedemption.redeemedAt)}
          </p>
        </section>
      )}

      <Link
        href="/"
        className="block w-full py-4 bg-salon-olive text-white text-center font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-folk"
      >
        Agendar mi cita
      </Link>

      <p className="text-[10px] text-salon-gray/80 text-center leading-relaxed mt-4">
        El día de tu cita, acerca tu celular al sticker del estudio y tu sello cae solito.
      </p>
    </Shell>
  );
}
