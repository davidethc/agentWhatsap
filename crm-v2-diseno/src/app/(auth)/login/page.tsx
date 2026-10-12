"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn.email({ email, password });
    setLoading(false);
    if (err) {
      setError(
        err.status === 429
          ? "Demasiados intentos. Espera unos minutos."
          : "Correo o contraseña incorrectos."
      );
      return;
    }
    // A la raíz, no a la Bandeja: ahí se decide si toca la guía de inicio
    // (#86) o la Bandeja de siempre.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="card-surface shadow-md">
      <div className="flex flex-col gap-1.5 border-b px-6 pb-4 pt-5">
        <p className="kicker">Acceso</p>
        <h2 className="text-[17px] font-bold leading-tight tracking-tight">Iniciar sesión</h2>
      </div>
      <div className="px-6 pb-6 pt-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger-soft bg-danger-tint px-3 py-2 text-[13px] text-danger-text"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
          <p className="text-center text-[13px] text-text-3">
            ¿Primera vez aquí?{" "}
            <Link href="/register" className="rounded-sm font-medium text-brand-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover">
              Crear la cuenta inicial
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
