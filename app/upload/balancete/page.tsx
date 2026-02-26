"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowLeft,
  Info,
  AlertTriangle,
  Calendar,
  Trash2,
  X,
  Loader2,
  Database,
  RefreshCw,
} from "lucide-react";

const MESES = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

const ANOS = ["23", "24", "25", "26"];

interface UploadedFile {
  id: string;
  period: string | null;
  name: string;
  updatedAt: string;
  recordCount?: number;
}

export default function UploadBalancetePage() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error" | "warning">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("JAN");
  const [selectedYear, setSelectedYear] = useState<string>("25");
  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);

  // Estados para processamento
  const [processing, setProcessing] = useState(false);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);

  // Estados para limpeza de base
  const [showClearModal, setShowClearModal] = useState(false);
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
      fetchExistingFiles(stored);
    }
  }, []);

  const fetchCompanyInfo = async (companyId: string) => {
    try {
      const res = await fetch("/api/user/companies");
      const data = await res.json();
      const company = data.companies?.find((c: { id: string }) => c.id === companyId);
      if (company) {
        setCompanyName(company.name);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    }
  };

  const fetchExistingFiles = async (companyId: string) => {
    try {
      const res = await fetch(`/api/files/balancete?companyId=${companyId}`);
      const data = await res.json();
      setExistingFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const getPeriod = () => `${selectedMonth}/${selectedYear}`;

  const periodExists = existingFiles.some(f => f.period === getPeriod());

  const processFile = async (fileId: string): Promise<{ success: boolean; message: string; records?: number }> => {
    try {
      setProcessingFileId(fileId);
      setProcessing(true);

      const res = await fetch("/api/files/balancete/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          fileId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.error || "Erro ao processar" };
      }

      return { 
        success: true, 
        message: `${data.insertedRecords} registros processados`,
        records: data.insertedRecords 
      };
    } catch (error) {
      console.error("Process error:", error);
      return { success: false, message: error instanceof Error ? error.message : "Erro desconhecido" };
    } finally {
      setProcessing(false);
      setProcessingFileId(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".csv")) {
        setStatusMessage("Formato inválido. Envie um arquivo Excel (.xlsx) ou CSV.");
        setUploadStatus("error");
        return;
      }
      setSelectedFile(file);
      setUploadStatus("idle");
      setStatusMessage("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !companyId) return;

    setUploading(true);
    setUploadStatus("idle");

    try {
      // 1. Get presigned URL
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          isPublic: false,
        }),
      });

      const { uploadUrl, cloudStoragePath } = await presignedRes.json();

      // 2. Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error("Erro ao fazer upload do arquivo");
      }

      // 3. Save file reference in database
      const saveRes = await fetch("/api/files/balancete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          cloudStoragePath,
          fileName: selectedFile.name,
          period: getPeriod(),
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || "Erro ao salvar referência do arquivo");
      }

      // 4. Process the file to insert data into database
      setStatusMessage("Processando dados do balancete...");
      const fileId = saveData.file?.id;
      
      if (fileId) {
        const processResult = await processFile(fileId);
        
        if (processResult.success) {
          setUploadStatus("success");
          setStatusMessage(
            saveData.overwritten 
              ? `Arquivo do período ${getPeriod()} sobrescrito e processado! ${processResult.message}`
              : `Arquivo enviado e processado com sucesso! ${processResult.message}`
          );
        } else {
          setUploadStatus("warning");
          setStatusMessage(
            `Arquivo salvo, mas erro ao processar: ${processResult.message}`
          );
        }
      } else {
        if (saveData.overwritten) {
          setUploadStatus("warning");
          setStatusMessage(`Arquivo do período ${getPeriod()} foi sobrescrito!`);
        } else {
          setUploadStatus("success");
          setStatusMessage("Arquivo enviado com sucesso!");
        }
      }
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchExistingFiles(companyId);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = "Período;Número da Conta;Descrição da Conta;Saldo Anterior;Débito;Crédito;Saldo Final;Natureza da Conta";
    const example1 = "JAN/25;1.1.01.001;Caixa Geral;10000.00;5000.00;3000.00;12000.00;D";
    const example2 = "JAN/25;1.1.01.002;Banco do Brasil C/C;50000.00;25000.00;15000.00;60000.00;D";
    const example3 = "JAN/25;2.1.01.001;Fornecedores;-20000.00;8000.00;12000.00;-24000.00;C";
    
    const content = `${headers}\n${example1}\n${example2}\n${example3}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_balancete.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const getClearPeriodRange = () => {
    return `${clearStartMonth}/${clearStartYear} a ${clearEndMonth}/${clearEndYear}`;
  };

  const handleClearBalancetes = async () => {
    if (!companyId) return;

    setClearing(true);
    setClearStatus("idle");

    try {
      const res = await fetch("/api/files/balancete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          startPeriod: `${clearStartMonth}/${clearStartYear}`,
          endPeriod: `${clearEndMonth}/${clearEndYear}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao limpar balancetes");
      }

      setClearStatus("success");
      setClearMessage(`${data.deletedFiles} arquivo(s) e ${data.deletedRecords} registro(s) removidos com sucesso!`);
      fetchExistingFiles(companyId);
      
      setTimeout(() => {
        setShowClearModal(false);
        setClearStatus("idle");
        setClearMessage("");
      }, 2000);
    } catch (error) {
      console.error("Clear error:", error);
      setClearStatus("error");
      setClearMessage(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setClearing(false);
    }
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
            <h1 className="text-2xl font-bold text-gray-800">Upload de Balancete</h1>
            <p className="text-gray-500">
              Empresa: <span className="font-medium text-gray-700">{companyName || "Carregando..."}</span>
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-gray-800">Selecione o Período</h3>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-2">Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {MESES.map((mes) => (
                  <option key={mes} value={mes}>{mes}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-2">Ano</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {ANOS.map((ano) => (
                  <option key={ano} value={ano}>20{ano}</option>
                ))}
              </select>
            </div>
          </div>

          {periodExists && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-amber-800 font-medium">Período já possui arquivo</p>
                <p className="text-amber-700 text-sm">O upload sobrescreverá o arquivo existente do período {getPeriod()}.</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Instructions Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800 mb-2">Formato do Arquivo</h3>
              <p className="text-sm text-blue-700 mb-3">
                O arquivo deve conter as seguintes colunas:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span className="bg-blue-100 px-2 py-1 rounded">Período (MMM/AA)</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Número da Conta</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Descrição da Conta</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Saldo Anterior</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Débito</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Crédito</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Saldo Final</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Natureza (D/C)</span>
              </div>
              <button
                onClick={downloadTemplate}
                className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Baixar modelo de exemplo
              </button>
            </div>
          </div>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-8"
        >
          {/* Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              selectedFile
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            {selectedFile ? (
              <>
                <FileSpreadsheet className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
                <p className="text-sm text-green-600 mt-2">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-600">
                  Clique ou arraste o arquivo aqui
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Formatos aceitos: Excel (.xlsx) ou CSV
                </p>
              </>
            )}
          </div>

          {/* Status Messages */}
          {uploadStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700">{statusMessage}</p>
            </motion.div>
          )}

          {uploadStatus === "warning" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-amber-700">{statusMessage}</p>
            </motion.div>
          )}

          {uploadStatus === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{statusMessage}</p>
            </motion.div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="mt-6 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>Enviando...</>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                {periodExists ? `Sobrescrever Balancete ${getPeriod()}` : `Enviar Balancete ${getPeriod()}`}
              </>
            )}
          </button>
        </motion.div>

        {/* Existing Files */}
        {existingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 mt-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">Arquivos Enviados</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Clique em "Reprocessar" para atualizar dados no banco
              </span>
            </div>
            <div className="space-y-2">
              {existingFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-800">{file.period || "Sem período"}</p>
                      <p className="text-sm text-gray-500">{file.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-400">
                      {new Date(file.updatedAt).toLocaleDateString("pt-BR")}
                    </p>
                    <button
                      onClick={async () => {
                        const result = await processFile(file.id);
                        if (result.success) {
                          setUploadStatus("success");
                          setStatusMessage(`Arquivo ${file.period} reprocessado! ${result.message}`);
                        } else {
                          setUploadStatus("error");
                          setStatusMessage(`Erro ao reprocessar: ${result.message}`);
                        }
                        fetchExistingFiles(companyId);
                      }}
                      disabled={processing}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all disabled:opacity-50"
                    >
                      {processingFileId === file.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          Reprocessar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Limpar Base Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-lg p-6 mt-6 border-l-4 border-red-500"
        >
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-gray-800">Limpar Base de Balancetes</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Remova balancetes de um período específico. Esta ação é irreversível.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Período Inicial */}
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

            {/* Período Final */}
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

          <button
            onClick={() => setShowClearModal(true)}
            disabled={existingFiles.length === 0}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Limpar Balancetes do Período {getClearPeriodRange()}
          </button>

          {existingFiles.length === 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Nenhum balancete disponível para limpar
            </p>
          )}
        </motion.div>
      </div>

      {/* Modal de Confirmação */}
      <AnimatePresence>
        {showClearModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !clearing && setShowClearModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Confirmar Exclusão</h3>
                </div>
                <button
                  onClick={() => !clearing && setShowClearModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  disabled={clearing}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Você está prestes a excluir todos os balancetes do período:
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-xl font-bold text-red-700">{getClearPeriodRange()}</p>
                  <p className="text-sm text-red-600 mt-1">
                    Empresa: {companyName}
                  </p>
                </div>
                <p className="text-sm text-red-600 mt-4 font-medium">
                  ⚠️ Esta ação é irreversível. Todos os arquivos e dados do período serão removidos permanentemente.
                </p>
              </div>

              {clearStatus === "success" && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-700">{clearMessage}</p>
                </div>
              )}

              {clearStatus === "error" && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700">{clearMessage}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearBalancetes}
                  disabled={clearing || clearStatus === "success"}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearing ? (
                    "Excluindo..."
                  ) : clearStatus === "success" ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Concluído
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Confirmar Exclusão
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
