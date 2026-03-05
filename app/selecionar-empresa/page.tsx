"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Building2,
  LogOut,
  BarChart3,
} from "lucide-react";
import { resolveCompanyRedirect } from "@/lib/company-selection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  role: string;
}

export default function SelecionarEmpresaPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetchCompanies();
    }
  }, [status]);

  const fetchCompanies = async () => {
    try {
      const { target, companies: userCompanies } = await resolveCompanyRedirect();
      const normalizedCompanies: Company[] = userCompanies.map((company) => ({
        id: company.id,
        name: company.name,
        cnpj: company.cnpj ?? null,
        role: company.role ?? "CONSULTA",
      }));

      setCompanies(normalizedCompanies);

      if (target === "/dashboard") {
        if (normalizedCompanies.length === 1) {
          setSelectedCompany(normalizedCompanies[0].id);
        }
        router.replace("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompany(companyId);
    localStorage.setItem("selectedCompany", companyId);
    const company = companies.find((c) => c.id === companyId);
    if (company?.name) {
      localStorage.setItem("selectedCompanyName", company.name);
    }
  };

  const handleContinue = () => {
    if (selectedCompany) {
      router.push("/dashboard");
    }
  };

  const selectedCompanyData = companies.find((c) => c.id === selectedCompany);
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#8E8E8E] text-base">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Image src="/planning-logo.png" alt="Planning" width={340} height={92} className="h-16 w-auto" priority />
              <h1 className="text-2xl font-semibold text-[#13161C]">Bem-vindo, {session?.user?.name || session?.user?.email}</h1>
            </div>
            <p className="text-[#8E8E8E] text-sm">
              Nível de acesso: {session?.user?.role}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#13161C] px-4 py-2 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-visible"
        >
          <div className="px-8 pt-8 pb-5">
            <h2 className="text-xl font-semibold text-[#13161C] mb-6 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#08C97D]" />
              Selecione a Empresa
            </h2>

            {companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Você não possui acesso a nenhuma empresa.</p>
                <p className="text-gray-400 text-sm mt-2">
                  Entre em contato com um administrador para solicitar acesso.
                </p>
              </div>
            ) : (
              <>
                {/* Company Selector */}
                <div className="mb-6">
                  <Select value={selectedCompany} onValueChange={handleSelectCompany}>
                    <SelectTrigger className="h-auto min-h-[52px] px-4 py-3 border-2 border-[#E5E7EB] rounded-lg hover:border-[#08C97D] transition-all bg-white text-left">
                      <SelectValue placeholder="Selecione uma empresa..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {companies.map((company) => (
                        <SelectItem
                          key={company.id}
                          value={company.id}
                          textValue={company.name}
                          className="py-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-[#13161C]">{company.name}</span>
                            <span className="text-xs text-[#8E8E8E]">
                              {company.cnpj ? `CNPJ: ${company.cnpj}` : "Sem CNPJ"} • {company.role}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Continue Button */}
                <button
                  onClick={handleContinue}
                  disabled={!selectedCompany}
                  className="w-full bg-[#08C97D] text-[#13161C] py-3 rounded-lg font-semibold hover:bg-[#0AE18C] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-5 h-5" />
                  Acessar Dashboard
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
