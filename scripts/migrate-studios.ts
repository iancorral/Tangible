// scripts/migrate-studios.ts
//
// Pasa la base de datos de "un solo negocio" a estudios (Tangible + iLoveMe).
//
//   npm run studios:migrate              → simulacro: cuenta qué cambiaría, no escribe
//   npm run studios:migrate -- --apply   → aplica
//
// Se puede correr las veces que sea: solo toca lo que falta. Correrlo antes Y
// después de desplegar el código nuevo atrapa citas creadas en medio por la
// versión anterior.
//
// Qué hace:
//   1. Crea los estudios "tangible" e "iloveme" si no existen.
//   2. Pone studioId = Tangible a todo documento que no tenga estudio.
//   3. Renombra admin@tangible.com → tania@tangible.com (misma contraseña).
//   4. Da a iLoveMe una copia del catálogo y del horario semanal de Tangible.
//   5. Quita índices únicos viejos (teléfono global, programa único) que
//      impedirían que una clienta exista en los dos estudios.
//
// Después: `npx prisma db push` crea los índices nuevos, y
// `npm run users:create` crea la cuenta de Alejandra.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const STUDIOS = [
  {
    slug: "tangible",
    name: "Tangible Nails & Art Studio",
    shortName: "Tangible",
    logoPath: null,
    features: { rewards: true, publicBooking: true },
  },
  {
    slug: "iloveme",
    name: "iLoveMe Beauty Salon",
    shortName: "iLoveMe",
    logoPath: "/studios/iloveme/logo.png",
    features: { rewards: false, publicBooking: false },
  },
] as const;

// Colecciones (= nombre del modelo en schema.prisma) que llevan studioId.
const SCOPED_COLLECTIONS = [
  "User", "Service", "Customer", "ClaimCode", "Stamp", "Redemption", "Appointment",
  "WorkSchedule", "BlockedDate", "Reminder", "AvailabilityOverride", "Note", "RewardProgram",
];

// Índices de la versión de un solo negocio que estorban con varios estudios.
const OBSOLETE_INDEXES: [collection: string, index: string][] = [
  ["Customer", "Customer_phone_key"],
  ["RewardProgram", "RewardProgram_key_key"],
];

const MISSING_STUDIO = { studioId: { $exists: false } };

async function countMissing(collection: string): Promise<number> {
  const res = (await prisma.$runCommandRaw({ count: collection, query: MISSING_STUDIO })) as { n: number };
  return res.n;
}

async function main() {
  console.log(APPLY ? "APPLY: se escribirán cambios\n" : "SIMULACRO: no se escribe nada\n");

  // 1. Estudios
  const ids: Record<string, string> = {};
  for (const studio of STUDIOS) {
    const existing = await prisma.studio.findUnique({ where: { slug: studio.slug } });
    if (existing) {
      ids[studio.slug] = existing.id;
      console.log(`Estudio ${studio.slug}: ya existe`);
    } else if (APPLY) {
      const created = await prisma.studio.create({ data: { ...studio, features: { ...studio.features } } });
      ids[studio.slug] = created.id;
      console.log(`Estudio ${studio.slug}: creado`);
    } else {
      console.log(`Estudio ${studio.slug}: se crearía`);
    }
  }

  // 2. Todo lo existente es de Tangible
  console.log("\nDocumentos sin estudio (pasarían a Tangible):");
  for (const collection of SCOPED_COLLECTIONS) {
    const missing = await countMissing(collection);
    console.log(`  ${collection.padEnd(22)} ${missing}${APPLY && missing ? " → Tangible" : ""}`);
    if (APPLY && missing > 0) {
      await prisma.$runCommandRaw({
        update: collection,
        updates: [{ q: MISSING_STUDIO, u: { $set: { studioId: { $oid: ids.tangible } } }, multi: true }],
      });
    }
  }

  // 3. Cuenta de Tania. Lectura y escritura en crudo: en un simulacro los
  // usuarios todavía no tienen studioId y el cliente de Prisma no los leería.
  const findUserRaw = async (email: string) =>
    ((await prisma.$runCommandRaw({ find: "User", filter: { email }, limit: 1 })) as {
      cursor: { firstBatch: unknown[] };
    }).cursor.firstBatch.length > 0;
  const admin = await findUserRaw("admin@tangible.com");
  const tania = await findUserRaw("tania@tangible.com");
  if (admin && !tania) {
    console.log("\nadmin@tangible.com → tania@tangible.com (nombre: Tania, misma contraseña)");
    if (APPLY) {
      await prisma.$runCommandRaw({
        update: "User",
        updates: [{ q: { email: "admin@tangible.com" }, u: { $set: { email: "tania@tangible.com", name: "Tania" } } }],
      });
    }
  } else {
    console.log(`\nCuenta de Tania: ${tania ? "ya existe" : "no se encontró admin@tangible.com"}`);
  }

  // 4. Catálogo y horario de iLoveMe (copia inicial de Tangible)
  if (ids.tangible && ids.iloveme) {
    const ilovemeServices = await prisma.service.count({ where: { studioId: ids.iloveme } });
    const tangibleServices = await prisma.service.findMany({ where: { studioId: ids.tangible } });
    if (ilovemeServices === 0) {
      console.log(`\nCatálogo iLoveMe: ${APPLY ? "copiados" : "se copiarían"} ${tangibleServices.length} servicios de Tangible`);
      if (APPLY && tangibleServices.length) {
        await prisma.service.createMany({
          data: tangibleServices.map((s) => ({
            studioId: ids.iloveme,
            name: s.name,
            duration: s.duration,
            price: s.price,
            description: s.description,
            category: s.category,
            isActive: s.isActive,
            appointmentIDs: [],
          })),
        });
      }
    } else {
      console.log(`\nCatálogo iLoveMe: ya tiene ${ilovemeServices} servicios`);
    }

    const ilovemeSchedule = await prisma.workSchedule.count({ where: { studioId: ids.iloveme } });
    const tangibleSchedule = await prisma.workSchedule.findMany({ where: { studioId: ids.tangible } });
    if (ilovemeSchedule === 0 && tangibleSchedule.length) {
      console.log(`Horario iLoveMe: ${APPLY ? "copiados" : "se copiarían"} ${tangibleSchedule.length} días de Tangible`);
      if (APPLY) {
        await prisma.workSchedule.createMany({
          data: tangibleSchedule.map(({ dayOfWeek, startTime, endTime, isDayOff }) => ({
            studioId: ids.iloveme, dayOfWeek, startTime, endTime, isDayOff,
          })),
        });
      }
    } else {
      console.log(`Horario iLoveMe: ${ilovemeSchedule ? "ya existe" : "Tangible no tiene horario guardado (usa el predeterminado)"}`);
    }
  } else {
    console.log("\n(El catálogo y horario de iLoveMe se copian al aplicar, cuando existan los estudios.)");
  }

  // 5. Índices viejos
  console.log("\nÍndices únicos de un solo negocio:");
  for (const [collection, index] of OBSOLETE_INDEXES) {
    const res = (await prisma.$runCommandRaw({ listIndexes: collection })) as {
      cursor: { firstBatch: { name: string }[] };
    };
    const present = res.cursor.firstBatch.some((i) => i.name === index);
    console.log(`  ${collection}.${index}: ${present ? (APPLY ? "eliminado" : "se eliminaría") : "no existe"}`);
    if (APPLY && present) await prisma.$runCommandRaw({ dropIndexes: collection, index });
  }

  console.log(APPLY ? "\nListo. Sigue: npx prisma db push" : "\nNada escrito. Repite con --apply.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
