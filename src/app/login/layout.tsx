import type { ReactNode } from "react";

// La marca (íconos, nombre y contenido) la decide la página según ?studio= o
// el último estudio de este dispositivo: ver app/login/page.tsx.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
