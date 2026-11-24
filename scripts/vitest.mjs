// Lanza Vitest con la letra de unidad en mayúscula. En Windows, la terminal de
// VS Code abre en "c:\..." y Vitest 4+ carga dos copias de sí mismo según cómo
// esté escrita la ruta: todas las suites fallan sin correr ninguna prueba.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cwd =
  process.platform === "win32"
    ? process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase())
    : process.cwd();
// El binario también va con la unidad corregida: si no, Node lo carga desde "c:\".
const bin = join(cwd, "node_modules", "vitest", "vitest.mjs");

const { status } = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd,
  stdio: "inherit",
});
process.exit(status ?? 1);
