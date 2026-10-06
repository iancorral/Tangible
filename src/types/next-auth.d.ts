import type { DefaultSession } from "next-auth";

// La sesión del panel lleva el usuario y su estudio (ver lib/tenant.ts).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      studioId?: string;
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
