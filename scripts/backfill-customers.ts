// scripts/backfill-customers.ts
//
// One-shot migration for the Rewards module: turns the client details already
// denormalized on every appointment into real Customer records, and links each
// appointment back to its customer.
//
//   npm run backfill:customers          → dry run, writes nothing
//   npm run backfill:customers -- --apply
//
// Safe to run more than once: it upserts by phone and only writes the link on
// appointments that do not have one yet. Re-run it any time to repair
// appointments that were created while the database was unreachable.
//
// It deliberately grants NO stamps. Existing regulars start at zero; the owner
// hands out manual stamps from the admin panel if she wants to reward them.

import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../src/lib/phone";
import { resolveStudioArg } from "./lib/studio";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Group = {
  phone: string;
  /**
   * Most recent spelling of the name wins, matching runtime behaviour — except
   * that a name from a live appointment always beats one from a cancelled one.
   * Cancelled bookings are where placeholder names ("Natalia clienta") live, and
   * a customer record should not inherit one just because it happens to be last.
   */
  name: string;
  nameIsActive: boolean;
  nameDate: Date;
  appointmentIds: string[];
  /** Every distinct name seen, and whether it ever appeared on a live booking. */
  names: Map<string, boolean>;
};

async function main() {
  console.log(APPLY ? "APPLY — writing changes\n" : "DRY RUN — nothing will be written\n");

  const { id: studioId } = await resolveStudioArg(prisma);

  const appointments = await prisma.appointment.findMany({
    where: { studioId },
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      date: true,
      status: true,
      customerId: true,
    },
    orderBy: { date: "asc" },
  });

  const groups = new Map<string, Group>();
  let missingPhone = 0;
  const unusablePhones: { id: string; name: string; phone: string }[] = [];

  for (const appointment of appointments) {
    const phone = normalizePhone(appointment.clientPhone);
    if (!phone) {
      const raw = appointment.clientPhone?.trim() ?? "";
      if (raw) {
        // A phone was recorded but has fewer than 10 digits, so it cannot
        // identify anyone. Worth fixing by hand before applying: each one is a
        // client who would otherwise never get a loyalty card.
        unusablePhones.push({ id: appointment.id, name: appointment.clientName.trim(), phone: raw });
      } else {
        missingPhone++;
      }
      continue;
    }

    const name = appointment.clientName.trim();
    const isActive = appointment.status !== "CANCELLED";
    const existing = groups.get(phone);

    if (!existing) {
      groups.set(phone, {
        phone,
        name,
        nameIsActive: isActive,
        nameDate: appointment.date,
        appointmentIds: [appointment.id],
        names: new Map([[name, isActive]]),
      });
      continue;
    }

    existing.appointmentIds.push(appointment.id);
    existing.names.set(name, existing.names.get(name) === true || isActive);

    // A live booking outranks a cancelled one; otherwise the newer name wins.
    const outranks = isActive && !existing.nameIsActive;
    const isNewerInSameClass =
      isActive === existing.nameIsActive && appointment.date >= existing.nameDate;

    if (outranks || isNewerInSameClass) {
      existing.name = name;
      existing.nameIsActive = isActive;
      existing.nameDate = appointment.date;
    }
  }

  const linkable = appointments.length - missingPhone - unusablePhones.length;

  console.log(`Appointments read        : ${appointments.length}`);
  console.log(`No phone recorded        : ${missingPhone} (left unlinked, as intended)`);
  console.log(`Phone too short to use   : ${unusablePhones.length}`);
  console.log(`Appointments to link     : ${linkable}`);
  console.log(`Customers to create      : ${groups.size}`);
  console.log(
    `Check                    : ${missingPhone} + ${unusablePhones.length} + ${linkable} = ` +
      `${missingPhone + unusablePhones.length + linkable} of ${appointments.length}\n`
  );

  if (unusablePhones.length > 0) {
    console.log(`Appointments with an unusable phone (${unusablePhones.length}) — fix these first:`);
    for (const entry of unusablePhones) {
      console.log(`  ${entry.id}  ${JSON.stringify(entry.phone)}  ${entry.name}`);
    }
    console.log("");
  }

  // Every key should be 10 digits. Anything else is a number normalizePhone did
  // not recognize and passed through untouched — worth eyeballing before it
  // becomes a permanent customer identity.
  const oddKeys = [...groups.keys()].filter((phone) => phone.length !== 10);
  if (oddKeys.length > 0) {
    console.log(`Phone keys that are not 10 digits (${oddKeys.length}):`);
    for (const key of oddKeys) {
      console.log(`  ${key}  (${key.length} digits)  →  ${groups.get(key)?.name}`);
    }
    console.log("");
  }

  // The interesting case: one phone, several names — a mother booking for her
  // daughter, or two people sharing a number. They will share one loyalty card,
  // so the owner should see this list and split them by hand if that is wrong.
  const shared = [...groups.values()].filter((group) => group.names.size > 1);
  if (shared.length > 0) {
    console.log(`Phones used by more than one name (${shared.length}) — review these:`);
    for (const group of shared) {
      // A name that only ever appeared on cancelled bookings is almost always a
      // placeholder from a booking that was redone, not a second person.
      const names = [...group.names.entries()].map(([name, seenActive]) =>
        seenActive ? name : `${name} (solo en canceladas)`
      );
      console.log(`  ${group.phone}  →  keeping "${group.name}"`);
      console.log(`                 seen as: ${names.join(" | ")}`);
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("Re-run with --apply to write.");
    return;
  }

  let customersWritten = 0;
  let appointmentsLinked = 0;

  for (const group of groups.values()) {
    // Never rewrite an existing customer: the name on a Customer is owned by the
    // Clientas screen, and re-running this to repair links must not undo an edit
    // the owner made there. Same rule as lib/customers.ts.
    const existing = await prisma.customer.findUnique({
      where: { studioId_phone: { studioId, phone: group.phone } },
      select: { id: true },
    });

    const customer =
      existing ??
      (await prisma.customer.create({ data: { studioId, phone: group.phone, name: group.name } }));
    if (!existing) customersWritten++;

    // Only touch appointments that are not linked yet, so re-running never
    // overwrites a link an admin has since corrected by editing the appointment.
    //
    // Both halves of the OR are required. On MongoDB a field that was never
    // written is ABSENT, not null, and Prisma's `customerId: null` does not match
    // an absent field — it silently matches nothing. Appointments predating this
    // migration are absent; appointments whose phone was later cleared hold an
    // explicit null. Filtering on either one alone misses half the collection.
    const linked = await prisma.appointment.updateMany({
      where: {
        studioId,
        id: { in: group.appointmentIds },
        OR: [{ customerId: null }, { customerId: { isSet: false } }],
      },
      data: { customerId: customer.id },
    });
    appointmentsLinked += linked.count;
  }

  console.log(`Customers created        : ${customersWritten}`);
  console.log(`Appointments linked      : ${appointmentsLinked}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
