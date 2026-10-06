"use client";

import { createContext, useContext } from "react";
import type { StudioBrand } from "@/lib/studio-brand";
import { adminHref } from "@/lib/admin-path";

const StudioContext = createContext<StudioBrand | null>(null);

/** Comparte la marca del estudio de la sesión con todo el panel. */
export function StudioProvider({ brand, children }: { brand: StudioBrand; children: React.ReactNode }) {
  return <StudioContext.Provider value={brand}>{children}</StudioContext.Provider>;
}

/** Enlace dentro del panel que funciona en admin.<dominio> y bajo /admin. */
export function useAdminHref(): (path: string) => string {
  const { adminBase } = useStudio();
  return (path: string) => adminHref(adminBase, path);
}

export function useStudio(): StudioBrand {
  const brand = useContext(StudioContext);
  if (!brand) throw new Error("useStudio debe usarse dentro de StudioProvider (layout del panel)");
  return brand;
}
