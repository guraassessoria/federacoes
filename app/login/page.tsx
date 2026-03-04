"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { Mail, Lock, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.replace("/selecionar-empresa");
      }
    } catch {
      setError("Erro ao processar solicitação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-16 bg-[#13161C]" />

      <div className="flex items-center justify-center p-4 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="px-8 py-6 text-center border-b border-[#E5E7EB]">
              <div className="flex justify-center mb-4">
                <Image src="/planning-mark1.png" alt="Planning" width={190} height={52} className="h-10 w-auto" priority />
              </div>
              <p className="text-[#8E8E8E] mt-1 text-sm">Acesse sua conta</p>
            </div>

            <div className="p-8">
              <div className="flex items-center justify-center gap-2 mb-6 text-[#6B6E71]">
                <LogIn className="w-5 h-5 text-[#08C97D]" />
                <span className="font-medium">Login</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#6B6E71] mb-1">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#08C97D] focus:border-transparent"
                      placeholder="seu@email.com"
                      required
                    />
                    <Mail className="w-5 h-5 text-[#8E8E8E] absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#6B6E71] mb-1">Senha</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#08C97D] focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                    <Lock className="w-5 h-5 text-[#8E8E8E] absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#08C97D] text-[#13161C] py-3 rounded-lg font-semibold hover:bg-[#0AE18C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processando..." : "Entrar"}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-[#8E8E8E] mt-6 text-sm">Sistema de Gestão Financeira para Federações</p>
        </motion.div>
      </div>
    </div>
  );
}
