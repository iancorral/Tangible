// scripts/backup-db.ts
//
// Respaldo completo de la base de datos a archivos JSON locales.
//
//   npm run db:backup
//
// Escribe scripts/.backups/db-<fecha>/<Colección>.json (la carpeta está en
// .gitignore: contiene datos de clientas y nunca debe subirse). Solo lee.
//
// Los archivos están en Extended JSON ($oid, $date), el formato que entiende
// `mongoimport --jsonArray` si alguna vez hiciera falta restaurar.

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const listed = (await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true })) as {
    cursor: { firstBatch: { name: string }[] };
  };
  const collections = listed.cursor.firstBatch.map((c) => c.name).filter((n) => !n.startsWith("system.")).sort();

  const dir = join(__dirname, ".backups", `db-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(dir, { recursive: true });

  let total = 0;
  for (const name of collections) {
    const docs: unknown[] = [];
    let res = (await prisma.$runCommandRaw({ find: name, batchSize: 1000 })) as {
      cursor: { id: unknown; firstBatch?: unknown[]; nextBatch?: unknown[] };
    };
    docs.push(...(res.cursor.firstBatch ?? []));
    // Sigue pidiendo lotes mientras el servidor diga que hay más.
    while (res.cursor.id && JSON.stringify(res.cursor.id) !== "0" && JSON.stringify(res.cursor.id) !== '{"$numberLong":"0"}') {
      res = (await prisma.$runCommandRaw({ getMore: res.cursor.id, collection: name, batchSize: 1000 } as never)) as typeof res;
      docs.push(...(res.cursor.nextBatch ?? []));
    }
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(docs, null, 2));
    console.log(`  ${name.padEnd(22)} ${docs.length}`);
    total += docs.length;
  }
  console.log(`\nRespaldo: ${total} documentos en ${dir}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
