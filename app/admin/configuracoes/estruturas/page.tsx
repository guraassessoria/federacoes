"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from '@/lib/constants';
import { motion } from "framer-motion";
import {
  Settings,
  ArrowLeft,
  FileSpreadsheet,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

type StructureSummary = {
  type: string;
  version: number;
  updatedAt: string;
};

const STRUCTURE_TYPES = [
  { type: "BP", name: "Balanço Patrimonial", description: "Estrutura padrão do BP" },
  { type: "DRE", name: "DRE", description: "Demonstração do Resultado" },
  { type: "DFC", name: "DFC", description: "Demonstração dos Fluxos de Caixa" },
  { type: "DMPL", name: "DMPL", description: "Mutações do Patrimônio Líquido" },
  { type: "DRA", name: "DRA", description: "Demonstração do Resultado Abrangente" },
];

export default function AdminConfiguracoesPage() {
  const router = useRouter();
  const [structures, setStructures] = useState<StructureSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStructures();
  }, []);

  const fetchStructures = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN_STANDARD_FILES, { cache: "no-store" });
      const data = await res.json();
      setStructures(data.structures || []);
    } catch (error) {
      console.error("Error fetching structures:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStructureInfo = (type: string) => {
    return structures.find((s) => s.type === type);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
            <p className="text-gray-500">Gerencie as estruturas padrão do sistema</p>
          </div>
        </div>

        {/* Estruturas Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-gray-600" />
              <div>
                <h2 className="text-lg font-semibold">Estruturas das Demonstrações</h2>
                <p className="text-sm text-gray-500">
                  Estruturas globais usadas por todas as empresas
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/admin/configuracoes/estruturas")}
              className="flex items-center gap-2 bg-[#08C97D] text-[#13161C] px-4 py-2 rounded-lg hover:bg-[#0AE18C] transition-all text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Gerenciar Estruturas
            </button>
          </div>

          <div className="space-y-3">
            {STRUCTURE_TYPES.map((sf) => {
              const info = getStructureInfo(sf.type);
              const isConfigured = info && info.version > 0;

              return (
                <div
                  key={sf.type}
                  onClick={() => router.push("/admin/configuracoes/estruturas")}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-[#08C97D] hover:bg-[#F7FDFC] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        isConfigured ? "bg-green-100" : "bg-gray-100"
                      }`}
                    >
                      <FileSpreadsheet
                        className={`w-6 h-6 ${
                          isConfigured ? "text-green-600" : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{sf.name}</h3>
                      <p className="text-sm text-gray-500">{sf.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {loading ? (
                      <span className="text-sm text-gray-400">Carregando...</span>
                    ) : isConfigured ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          v{info.version}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(info.updatedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        Não configurado
                      </span>
                    )}

                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#08C97D] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
