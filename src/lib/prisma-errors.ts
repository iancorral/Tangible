import { Prisma } from "@prisma/client";

/**
 * Prisma lanza P2025 cuando un update/delete no encuentra el registro. Con el
 * filtro por estudio eso incluye "existe, pero es de otro estudio": para quien
 * pregunta, ambos casos son un 404 y no se distinguen.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
