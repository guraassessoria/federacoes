"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  const { status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/selecionar-empresa");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-[#8E8E8E]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="h-16 bg-[#13161C]">
        <div className="mx-auto h-full max-w-6xl px-6 flex items-center justify-between">
          <Image src="/planning-logo.png" alt="Planning" width={340} height={92} className="h-16 w-auto" priority />
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-[#08C97D] px-4 py-2 text-sm font-semibold text-[#13161C] transition-colors hover:bg-[#0AE18C]"
          >
            Entrar
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-5xl font-light tracking-tight text-[#6B6E71]">Áreas</h1>
          <h2 className="text-5xl font-extrabold tracking-tight text-[#08C97D]">de atuação</h2>
        </header>

        <div className="mb-8 h-px w-full bg-[#E5E7EB]" />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-[#E5E7EB] p-6">
            <h3 className="text-2xl font-medium text-[#13161C]">Planejamento estratégico</h3>
            <p className="mt-4 text-base font-normal text-[#8E8E8E]">
              Estruturamos metas e indicadores para apoiar decisões com foco em crescimento sustentável.
            </p>
          </article>

          <article className="rounded-2xl border border-[#E5E7EB] p-6">
            <h3 className="text-2xl font-medium text-[#13161C]">Gestão financeira</h3>
            <p className="mt-4 text-base font-normal text-[#8E8E8E]">
              Consolidamos informações financeiras em análises claras para acompanhamento de desempenho.
            </p>
          </article>

          <article className="rounded-2xl border border-[#E5E7EB] p-6">
            <h3 className="text-2xl font-medium text-[#13161C]">Inteligência de dados</h3>
            <p className="mt-4 text-base font-normal text-[#8E8E8E]">
              Transformamos dados operacionais em insights acionáveis para reduzir riscos e melhorar resultados.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
