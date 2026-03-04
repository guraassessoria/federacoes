"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Building2,
  ChevronDown,
  LogOut,
  Settings,
  Users,
  FileSpreadsheet,
  BarChart3,
  Plus,
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/constants";

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
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetchCompanies();
    }
  }, [status]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.USER_COMPANIES);
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompany(companyId);
    setIsOpen(false);
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
  const isAdmin = session?.user?.role === "ADMIN";
  const isEditor = session?.user?.role === "EDITOR" || isAdmin;

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
              <Image src="/planning-logo.png" alt="Planning" width={170} height={46} className="h-8 w-auto" priority />
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
          <div className="p-8">
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
                <div className="relative mb-6">
                  <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 border-2 border-[#E5E7EB] rounded-lg hover:border-[#08C97D] transition-all bg-white"
                  >
                    <span className={selectedCompany ? "text-[#13161C]" : "text-[#8E8E8E]"}>
                      {selectedCompanyData?.name || "Selecione uma empresa..."}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-[#8E8E8E] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-50 w-full mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-60 overflow-auto"
                    >
                      {companies.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleSelectCompany(company.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-[#F7FDFC] transition-all flex items-center justify-between ${
                            selectedCompany === company.id ? "bg-[#F7FDFC]" : ""
                          }`}
                        >
                          <div>
                            <p className="font-medium text-gray-800">{company.name}</p>
                            {company.cnpj && (
                              <p className="text-sm text-gray-500">CNPJ: {company.cnpj}</p>
                            )}
                          </div>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {company.role}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
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

          {/* Quick Actions */}
          {(isAdmin || isEditor) && (
            <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] p-6">
              <h3 className="text-sm font-medium text-[#8E8E8E] mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {isEditor && (
                  <>
                    <button
                      onClick={() => router.push("/admin/dados")}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#08C97D] hover:shadow transition-all"
                    >
                      <FileSpreadsheet className="w-6 h-6 text-[#08C97D]" />
                      <span className="text-sm text-[#6B6E71]">Upload Balancete</span>
                    </button>
                    <button
                      onClick={() => router.push("/admin/dados")}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#08C97D] hover:shadow transition-all"
                    >
                      <FileSpreadsheet className="w-6 h-6 text-[#08C97D]" />
                      <span className="text-sm text-[#6B6E71]">Upload De x Para</span>
                    </button>
                  </>
                )}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => router.push("/admin/empresas")}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#08C97D] hover:shadow transition-all"
                    >
                      <Plus className="w-6 h-6 text-[#08C97D]" />
                      <span className="text-sm text-[#6B6E71]">Cadastrar Empresa</span>
                    </button>
                    <button
                      onClick={() => router.push("/admin/usuarios")}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#08C97D] hover:shadow transition-all"
                    >
                      <Users className="w-6 h-6 text-[#08C97D]" />
                      <span className="text-sm text-[#6B6E71]">Usuários</span>
                    </button>
                    <button
                      onClick={() => router.push("/admin/configuracoes")}
                      className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#08C97D] hover:shadow transition-all"
                    >
                      <Settings className="w-6 h-6 text-[#08C97D]" />
                      <span className="text-sm text-[#6B6E71]">Configurações</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
