import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;

/** Reglas de una contraseña nueva del panel (también las usa el formulario). */
export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Escribe tu contraseña actual"),
    next: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
      .max(200, "La contraseña es demasiado larga"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Las contraseñas nuevas no coinciden" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "La nueva contraseña debe ser distinta de la actual" });
