"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  FileSpreadsheet,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/constants";

const MESES = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

const ANOS = ["23", "24", "25", "26"];

interface CompanyFile {
  id: string;
  type: string;
  name: string;
  period: string | null;
  updatedAt: string;
}

export default function GerenciamentoDadosPage() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  
  // Estado para arquivos
  const [balancetes, setBalancetes] = useState<CompanyFile[]>([]);
  const [deParaFiles, setDeParaFiles] = useState<CompanyFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  // Estado para limpeza
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearType, setClearType] = useState<"balancetes" | "dePara" | "all">("all");
  const [clearStartMonth, setClearStartMonth] = useState<string>("JAN");
  const [clearStartYear, setClearStartYear] = useState<string>("23");
  const [clearEndMonth, setClearEndMonth] = useState<string>("DEZ");
  const [clearEndYear, setClearEndYear] = useState<string>("25");
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<"idle" | "success" | "error">("idle");
  const [clearMessage, setClearMessage] = useState("");

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

  const getClearPeriodRange = () => {
    return `${clearStartMonth}/${clearStartYear} a ${clearEndMonth}/${clearEndYear}`;
  };

  const handleClearData = async () => {
    if (!companyId) return;

    setClearing(true);
    setClearStatus("idle");

    try {
      const dataTypes: string[] = [];
      if (clearType === "balancetes" || clearType === "all") {
        dataTypes.push("balancetes");
      }
      if (clearType === "dePara" || clearType === "all") {
        dataTypes.push("dePara");
      }

      const res = await fetch(API_ENDPOINTS.CLEAR_DATA, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          startPeriod: `${clearStartMonth}/${clearStartYear}`,
          endPeriod: `${clearEndMonth}/${clearEndYear}`,
          dataTypes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao limpar dados");
      }

      // Montar mensagem de sucesso
      const messages: string[] = [];
      if (data.results?.balancetes) {
        messages.push(`Balancetes: ${data.results.balancetes.deletedFiles} arquivo(s) e ${data.results.balancetes.deletedRecords} registro(s)`);
      }
      if (data.results?.dePara) {
        messages.push(`De x Para: ${data.results.dePara.deletedFiles} arquivo(s)`);
      }

      setClearStatus("success");
      setClearMessage(`Dados removidos: ${messages.join(", ")}`);
      fetchFiles(companyId);
      
      setTimeout(() => {
        setShowClearModal(false);
        setClearStatus("idle");
        setClearMessage("");
      }, 3000);
    } catch (error) {
      console.error("Clear error:", error);
      setClearStatus("error");
      setClearMessage(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setClearing(false);
    }
  };

  const getTypeLabel = () => {
    switch (clearType) {
      case "balancetes": return "Balancetes";
      case "dePara": return "De x Para";
      case "all": return "Todos os Dados";
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

        {/* Seção de Limpeza */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Limpar Base de Dados</h3>
              <p className="text-sm text-gray-500">Remova balancetes, arquivos De x Para e dados financeiros</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Atenção</p>
                <p className="text-sm text-amber-700">
                  Esta ação é irreversível. Todos os dados selecionados serão permanentemente removidos.
                </p>
              </div>
            </div>
          </div>

          {/* Tipo de Dados */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Dados para Limpar</label>
            <div className="flex gap-4">
              <button
                onClick={() => setClearType("balancetes")}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  clearType === "balancetes"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Balancetes</span>
              </button>
              <button
                onClick={() => setClearType("dePara")}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  clearType === "dePara"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">De x Para</span>
              </button>
              <button
                onClick={() => setClearType("all")}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  clearType === "all"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Database className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Todos</span>
              </button>
            </div>
          </div>

          {/* Período para Balancetes */}
          {(clearType === "balancetes" || clearType === "all") && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Período Inicial</label>
                <div className="flex gap-2">
                  <select
                    value={clearStartMonth}
                    onChange={(e) => setClearStartMonth(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                  >
                    {MESES.map((mes) => (
                      <option key={mes} value={mes}>{mes}</option>
                    ))}
                  </select>
                  <select
                    value={clearStartYear}
                    onChange={(e) => setClearStartYear(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                  >
                    {ANOS.map((ano) => (
                      <option key={ano} value={ano}>20{ano}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Período Final</label>
                <div className="flex gap-2">
                  <select
                    value={clearEndMonth}
                    onChange={(e) => setClearEndMonth(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                  >
                    {MESES.map((mes) => (
                      <option key={mes} value={mes}>{mes}</option>
                    ))}
                  </select>
                  <select
                    value={clearEndYear}
                    onChange={(e) => setClearEndYear(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                  >
                    {ANOS.map((ano) => (
                      <option key={ano} value={ano}>20{ano}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowClearModal(true)}
            disabled={balancetes.length === 0 && deParaFiles.length === 0}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Limpar {getTypeLabel()}
          </button>
        </motion.div>

        {/* Modal de Confirmação */}
        <AnimatePresence>
          {showClearModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-800">Confirmar Exclusão</h3>
                  </div>
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-gray-600 mb-4">
                    Você está prestes a excluir <strong>{getTypeLabel()}</strong> da empresa <strong>{companyName}</strong>.
                  </p>
                  {(clearType === "balancetes" || clearType === "all") && (
                    <p className="text-sm text-gray-500">
                      Período: <strong>{getClearPeriodRange()}</strong>
                    </p>
                  )}
                </div>

                {clearStatus === "success" ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-green-700">{clearMessage}</p>
                  </div>
                ) : clearStatus === "error" ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-700">{clearMessage}</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowClearModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleClearData}
                      disabled={clearing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {clearing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {clearing ? "Excluindo..." : "Confirmar Exclusão"}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
