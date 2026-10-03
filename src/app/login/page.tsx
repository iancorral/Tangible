"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import MuralDecorations from "@/components/layout/MuralDecorations";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push("/admin");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-salon-bg p-6 relative">
      <MuralDecorations />
      <div className="relative z-10 w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-3xl border-2 border-salon-olive/30 shadow-folk p-8 hand-drawn">
        <div className="text-center mb-8">
          <h1 className="font-title text-2xl font-black text-salon-brown tracking-[0.3em] uppercase">
            Tangible
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1 opacity-70">
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full" />
            <p className="text-salon-terracotta text-[10px] uppercase tracking-[0.2em] font-bold">
              Panel Admin
            </p>
            <div className="h-[2px] w-6 bg-salon-terracotta rounded-full" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full bg-white border-2 border-salon-gray/30 px-4 py-3 text-salon-brown focus:border-salon-lavender focus:ring-0 outline-none transition-all hand-drawn placeholder:text-salon-gray/40 font-medium"
              placeholder="admin@tangible.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-salon-terracotta uppercase tracking-widest mb-2">
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full bg-white border-2 border-salon-gray/30 px-4 py-3 text-salon-brown focus:border-salon-lavender focus:ring-0 outline-none transition-all hand-drawn placeholder:text-salon-gray/40 font-medium"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-bold text-center bg-red-50 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-salon-brown text-salon-blush py-4 px-6 font-black text-sm uppercase tracking-widest shadow-folk transform active:scale-[0.98] transition-all disabled:opacity-50 hand-drawn border-2 border-salon-brown hover:bg-salon-brown/90 rounded-xl"
          >
            {loading ? "Entrando..." : "Entrar al panel"}
          </button>
        </form>
      </div>
    </main>
  );
}