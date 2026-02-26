"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Building2 } from "lucide-react";

export default function HomePage() {
  const { status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/selecionar-empresa");
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="flex justify-center mb-6">
          <div className="bg-white/20 p-4 rounded-full">
            <Building2 className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Dashboard Financeiro</h1>
        <p className="text-blue-200">Carregando...</p>
      </div>
    </div>
  );
}
