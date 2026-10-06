/**
 * Guardián del aislamiento entre estudios.
 *
 * Recorre el código de todas las rutas de la API y de las páginas que leen la
 * base, y falla si alguna consulta de Prisma no menciona `studioId`. Es una
 * revisión de texto, no de tipos: su trabajo es que nadie agregue una ruta
 * nueva que lea datos de todos los estudios sin darse cuenta.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Modelos que no pertenecen a un estudio.
const GLOBAL_MODELS = new Set(["studio", "claimAttempt"]);

// Consultas por una llave que ya es de un solo estudio: el ID viene de un pase
// firmado por el servidor o de un registro recién leído con studioId.
const ALLOWED: { file: RegExp; snippet: RegExp; why: string }[] = [
  { file: /lib[\\/]auth\.ts$/, snippet: /prisma\.user\.findUnique/, why: "login: busca la cuenta por correo" },
  { file: /lib[\\/]tenant\.ts$/, snippet: /prisma\.user\.findUnique/, why: "resuelve el estudio de la propia sesión" },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Texto entre el "(" de la llamada y su ")" correspondiente. */
function callArgs(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")" && --depth === 0) return source.slice(openIndex, i + 1);
  }
  return source.slice(openIndex);
}

const files = [...walk("src/app"), ...walk("src/lib")];
const CALL = /prisma\.(\w+)\.(\w+)\(/g;

const findings = files.flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const out: { file: string; call: string }[] = [];
  for (const match of source.matchAll(CALL)) {
    const [, model] = match;
    if (GLOBAL_MODELS.has(model)) continue;
    const args = callArgs(source, match.index! + match[0].length - 1);
    if (args.includes("studioId")) continue;
    const call = match[0] + args.slice(1, 80).replace(/\s+/g, " ");
    if (ALLOWED.some((a) => a.file.test(file) && a.snippet.test(match[0]))) continue;
    out.push({ file, call });
  }
  return out;
});

describe("aislamiento entre estudios", () => {
  it("toda consulta de Prisma filtra o escribe por studioId", () => {
    expect(findings, "Consultas sin studioId:\n" + findings.map((f) => `  ${f.file}: ${f.call}`).join("\n")).toEqual([]);
  });

  it("toda ruta del panel obtiene el estudio de la sesión", () => {
    const adminRoutes = walk("src/app/api/admin").filter((f) => f.endsWith("route.ts"));
    const missing = adminRoutes.filter((f) => !readFileSync(f, "utf8").includes("requireStudio()"));
    expect(missing).toEqual([]);
  });
});
