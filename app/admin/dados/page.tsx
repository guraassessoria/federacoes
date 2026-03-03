"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Database,
  FileSpreadsheet,
  ArrowLeft,
  RefreshCw,
  Upload,
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/constants";

interface CompanyFile {
  id: string;
  type: string;
  name: string;
  period: string | null;
  updatedAt: string;
}

export default function GerenciamentoDadosPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  
  // Estado para arquivos
  const [balancetes, setBalancetes] = useState<CompanyFile[]>([]);
  const [deParaFiles, setDeParaFiles] = useState<CompanyFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("selectedCompany");
    if (stored) {
      setCompanyId(stored);
      fetchCompanyInfo(stored);
      fetchFiles(stored);
    }
  }, []);

  const fetchCompanyInfo = async (companyId: string) => {
    try {
      const res = await fetch(API_ENDPOINTS.USER_COMPANIES);
      const data = await res.json();
      const company = data.companies?.find((c: { id: string }) => c.id === companyId);
      if (company) {
        setCompanyName(company.name);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    }
  };

  const fetchFiles = async (companyId: string) => {
    setLoadingFiles(true);
    try {
      // Buscar balancetes
      const balRes = await fetch(`${API_ENDPOINTS.FILES_BALANCETE}?companyId=${companyId}`);
      const balData = await balRes.json();
      setBalancetes(balData.files || []);

      // Buscar De x Para
      const deParaRes = await fetch(`${API_ENDPOINTS.FILES_DE_PARA}?companyId=${companyId}`);
      const deParaData = await deParaRes.json();
      setDeParaFiles(deParaData.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoadingFiles(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Dados</h1>
              <p className="text-gray-500">
                Empresa: <span className="font-medium text-gray-700">{companyName || "Carregando..."}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Resumo dos Dados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Balancetes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Balancetes</h3>
                  <p className="text-sm text-gray-500">Arquivos de balancete mensal</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-green-600">{balancetes.length}</span>
            </div>
            {loadingFiles ? (
              <div className="flex items-center gap-2 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : balancetes.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {balancetes.slice(0, 5).map((file) => (
                  <div key={file.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{file.period || "Sem período"}</span>
                    <span className="text-gray-400">{new Date(file.updatedAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
                {balancetes.length > 5 && (
                  <p className="text-xs text-gray-400">+{balancetes.length - 5} arquivo(s)</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhum arquivo encontrado</p>
            )}
          </motion.div>

          {/* De x Para */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">De x Para</h3>
                  <p className="text-sm text-gray-500">Arquivos de mapeamento contábil</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-purple-600">{deParaFiles.length}</span>
            </div>
            {loadingFiles ? (
              <div className="flex items-center gap-2 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : deParaFiles.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {deParaFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate">{file.name}</span>
                    <span className="text-gray-400">{new Date(file.updatedAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhum arquivo encontrado</p>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
