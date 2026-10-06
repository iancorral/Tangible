"use client";

import { createContext, useContext } from "react";
import type { StudioBrand } from "@/lib/studio-brand";

const StudioContext = createContext<StudioBrand | null>(null);

/** Comparte la marca del estudio de la sesión con todo el panel. */
export function StudioProvider({ brand, children }: { brand: StudioBrand; children: React.ReactNode }) {
  return <StudioContext.Provider value={brand}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioBrand {
  const brand = useContext(StudioContext);
  if (!brand) throw new Error("useStudio debe usarse dentro de StudioProvider (layout del panel)");
  return brand;
}
