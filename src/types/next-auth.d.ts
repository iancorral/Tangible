import type { DefaultSession } from "next-auth";

// La sesión del panel lleva el usuario y su estudio (ver lib/tenant.ts).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      studioId?: string;
      /** Segundos epoch en que se emitió el token (para invalidarlo al cambiar contraseña). */
      issuedAt?: number;
    } & DefaultSession["user"];
  }

  interface User {
    studioId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    studioId?: string;
  }
}
