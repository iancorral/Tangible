import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

/**
 * Finds or creates the Customer behind an appointment's contact details.
 *
 * Returns null when there is no usable phone number. That is not an error:
 * counter walk-ins and minors are booked without one on purpose, and those
 * appointments simply stay unlinked.
 *
 * An existing customer is never rewritten here. The name on a Customer is owned
 * by the Clientas screen; the name on an Appointment is the historical record of
 * what was booked that day. Letting a new booking update the customer would undo
 * the owner's corrections every time someone typed a nickname into the form.
 */
export async function resolveCustomerId(
  studioId: string,
  clientName: string,
  clientPhone: string | null | undefined
): Promise<string | null> {
  const phone = normalizePhone(clientPhone);
  if (!phone) return null;

  const name = clientName.trim();
  if (!name) return null;

  const existing = await prisma.customer.findUnique({
    where: { studioId_phone: { studioId, phone } },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.customer.create({ data: { studioId, phone, name } });
    return created.id;
  } catch (error) {
    // Two appointments created for the same new client at the same moment race
    // on the unique index. Losing that race just means the record now exists.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.customer.findUnique({
        where: { studioId_phone: { studioId, phone } },
        select: { id: true },
      });
      if (raced) return raced.id;
    }
    throw error;
  }
}
