// scripts/convert-appointments-to-notes.ts
//
// Convierte en Notas las "citas" que en realidad eran recordatorios personales
// (tianguis, fisio, eventos) capturados como citas gratis sin clienta.
//
//   npm run notes:convert                          → lista candidatas, no escribe nada
//   npm run notes:convert -- --ids=<id>,<id>       → simulacro con esas citas
//   npm run notes:convert -- --ids=<id>,<id> --apply
//
// Solo convierte los IDs que se le pasan: decidir qué es nota y qué es una
// cortesía a una clienta real es criterio de la dueña, no de un filtro.
//
// Por cada cita: crea la nota con el mismo día y horario, y la borra. Si era
// una cita confirmada a futuro, la nota queda apartando el horario, para que
// la web no ofrezca de golpe un espacio que antes estaba ocupado. Las
// canceladas pasan al archivo. Antes de borrar se guarda un respaldo en
// scripts/.backups/.

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const IDS = idsArg ? idsArg.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean) : [];
const OBJECT_ID = /^[a-f\d]{24}$/i;

function label(date: Date) {
  // Hora de Chihuahua (UTC-6), igual que lib/timezone.ts.
  return new Date(date.getTime() - 6 * 3600000).toISOString().slice(0, 16).replace("T", " ");
}

async function listCandidates() {
  const candidates = await prisma.appointment.findMany({
    // En MongoDB `null` no incluye documentos donde el campo ni existe, y las
    // citas anteriores a estos campos no los tienen.
    where: {
      AND: [
        { OR: [{ customerId: null }, { customerId: { isSet: false } }] },
        { OR: [{ clientPhone: null }, { clientPhone: { isSet: false } }] },
      ],
    },
    select: { id: true, date: true, clientName: true, status: true, finalPrice: true },
    orderBy: { date: "desc" },
  });
  console.log("Citas sin teléfono ni clienta (posibles notas):\n");
  for (const a of candidates) {
    const price = a.finalPrice === null ? "precio catálogo" : `$${a.finalPrice}`;
    console.log(`  ${a.id}  ${label(a.date)}  ${a.status.padEnd(9)}  ${price.padEnd(15)}  ${a.clientName}`);
  }
  console.log("\nPasa las que sean notas con --ids=<id>,<id> (sin --apply es simulacro).");
}

async function main() {
  if (IDS.length === 0) return listCandidates();

  const invalid = IDS.filter((id) => !OBJECT_ID.test(id));
  if (invalid.length) throw new Error(`IDs inválidos: ${invalid.join(", ")}`);

  console.log(APPLY ? "APPLY — se escribirán cambios\n" : "SIMULACRO — no se escribe nada\n");

  const appointments = await prisma.appointment.findMany({
    where: { id: { in: IDS } },
    include: { services: { select: { name: true } } },
  });

  const missing = IDS.filter((id) => !appointments.some((a) => a.id === id));
  if (missing.length) throw new Error(`No existen: ${missing.join(", ")}`);

  // Una clienta identificada nunca es una nota: es una cortesía real y tiene
  // historial (y quizá sellos) colgando de esa cita.
  const withCustomer = appointments.filter((a) => a.customerId);
  if (withCustomer.length) {
    throw new Error(
      `Estas citas pertenecen a una clienta y no se convierten: ${withCustomer
        .map((a) => `${a.id} (${a.clientName})`)
        .join(", ")}`
    );
  }

  const now = new Date();
  const plan = appointments.map((a) => {
    const cancelled = a.status === "CANCELLED";
    const services = a.services.map((s) => s.name).join(", ");
    return {
      appointment: a,
      note: {
        title: a.clientName.trim(),
        body: [a.adminNotes?.trim(), services && `(Registrada antes como cita: ${services})`]
          .filter(Boolean)
          .join("\n"),
        items: [],
        color: "CREAM",
        pinned: false,
        archived: cancelled,
        startAt: a.date,
        endAt: a.endDate,
        allDay: false,
        blocksSchedule: !cancelled && a.endDate > now,
        createdBy: "migración citas→notas",
      },
    };
  });

  for (const { appointment: a, note } of plan) {
    console.log(
      `  ${a.id}  ${label(a.date)}  "${note.title}"  →  nota` +
        `${note.archived ? " archivada" : ""}${note.blocksSchedule ? " (aparta horario)" : ""}`
    );
  }

  if (!APPLY) {
    console.log("\nNada escrito. Repite con --apply para convertir.");
    return;
  }

  const dir = join(__dirname, ".backups");
  mkdirSync(dir, { recursive: true });
  const backupFile = join(dir, `appointments-to-notes-${now.toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backupFile, JSON.stringify(appointments, null, 2));
  console.log(`\nRespaldo: ${backupFile}`);

  for (const { appointment: a, note } of plan) {
    await prisma.$transaction([
      prisma.note.create({ data: note }),
      // La relación con servicios vive en ambos documentos en MongoDB;
      // desconectarla primero evita dejar IDs huérfanos en Service.
      prisma.appointment.update({ where: { id: a.id }, data: { services: { set: [] } } }),
      prisma.reminder.deleteMany({ where: { appointmentId: a.id } }),
      prisma.appointment.delete({ where: { id: a.id } }),
    ]);
    console.log(`  ✓ ${a.clientName.trim()}`);
  }
  console.log(`\nListo: ${plan.length} cita(s) convertida(s) en nota.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
