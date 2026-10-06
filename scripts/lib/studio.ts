import type { PrismaClient, Studio } from "@prisma/client";

/**
 * Estudio sobre el que trabaja un script: `--studio=<slug>` (por defecto
 * "tangible"). Falla si no existe, para que un error de dedo no escriba datos
 * en el estudio equivocado.
 */
export async function resolveStudioArg(prisma: PrismaClient): Promise<Studio> {
  const arg = process.argv.find((a) => a.startsWith("--studio="));
  const slug = arg ? arg.slice("--studio=".length).trim() : "tangible";
  const studio = await prisma.studio.findUnique({ where: { slug } });
  if (!studio) throw new Error(`No existe el estudio "${slug}". Corre primero la migración de estudios.`);
  console.log(`Estudio: ${studio.name} (${studio.slug})\n`);
  return studio;
}
