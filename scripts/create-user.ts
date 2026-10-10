// scripts/create-user.ts
//
// Crea una cuenta del panel para un estudio con una contraseña TEMPORAL: puede
// usar el panel desde el primer momento, y el inicio le muestra un aviso hasta
// que elija la suya. Al cambiarla se cierran las sesiones abiertas con la
// temporal (por ejemplo, la de quien la creó para probar).
//
//   npm run users:create -- --email=alejandra@tangible.com --name=Alejandra --studio=iloveme
//   npm run users:create -- --email=alejandra@tangible.com --reset     (olvidó su contraseña)
//
// La contraseña se escribe al correr el script (no se ve en pantalla) y solo
// se guarda su hash bcrypt: nunca queda en el historial, el código ni un archivo.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { resolveStudioArg } from "./lib/studio";

const prisma = new PrismaClient();
const MIN_LENGTH = 10;

function arg(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found?.slice(name.length + 3).trim();
}

/** Pide un texto sin mostrarlo en pantalla. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        process.exit(130); // Ctrl+C
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function resetPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`No existe una cuenta con ${email}`);
  const password = await askNewPassword(email);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      // Cierra cualquier sesión abierta con la contraseña anterior.
      passwordChangedAt: new Date(),
    },
  });
  console.log(`Contraseña temporal puesta para ${email}. El panel le mostrará un aviso para cambiarla.`);
}

async function askNewPassword(email: string): Promise<string> {
  const password = await askHidden(`Contraseña temporal para ${email} (mín. ${MIN_LENGTH}): `);
  if (password.length < MIN_LENGTH) throw new Error(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
  const confirm = await askHidden("Repite la contraseña: ");
  if (confirm !== password) throw new Error("Las contraseñas no coinciden");
  return password;
}

async function main() {
  const email = arg("email")?.toLowerCase();
  if (email && process.argv.includes("--reset")) return resetPassword(email);
  const name = arg("name");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    throw new Error("Uso: npm run users:create -- --email=<correo> --name=<Nombre> --studio=<slug>");
  }

  const studio = await resolveStudioArg(prisma);
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`Ya existe una cuenta con ${email}`);
  }

  const password = await askNewPassword(email);

  await prisma.user.create({
    data: {
      email,
      name,
      studioId: studio.id,
      password: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });
  console.log(`Cuenta creada: ${email} → ${studio.name}`);
  console.log("Es una contraseña temporal: el panel le mostrará un aviso para cambiarla cuando quiera.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
