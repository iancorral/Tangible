import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getPanelSession } from "@/lib/tenant";
import { changePasswordSchema } from "@/lib/password-policy";

/**
 * Cambia la contraseña de la cuenta con sesión. Funciona también con una
 * contraseña temporal (es justo para salir de ese estado), por eso usa
 * getPanelSession y no requireStudio.
 *
 * Al guardar, `passwordChangedAt` invalida todas las sesiones anteriores —
 * incluida la de quien conocía la contraseña temporal.
 */
export async function POST(req: Request) {
  const session = await getPanelSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { current, next } = parsed.data;

  try {
    // La cuenta propia, por el id de la sesión firmada.
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { password: true } });
    if (!user || !(await bcrypt.compare(current, user.password))) {
      return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        password: await bcrypt.hash(next, 12),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
