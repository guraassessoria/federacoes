"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { upload } from "@vercel/blob/client";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowLeft,
  Info,
  AlertTriangle,
} from "lucide-react";

type ExistingFile = {
  id: string;
  name: string;
  updatedAt: string;
  uploadedBy: {
    name: string | null;
    email: string;
  };
};

export default function Page() {
  const { data: session } = useSession();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error" | "warning"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [existingFile, setExistingFile] = useState<ExistingFile | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("selectedCompany");
    if (stored) {
      setCompanyId(stored);
      void fetchCompanyInfo(stored);
      void fetchExistingFile(stored);
    }
  }, []);

  const fetchCompanyInfo = async (companyIdParam: string) => {
    try {
      const res = await fetch("/api/user/companies");
      const data = await res.json();
      const company = data.companies?.find((c: { id: string }) => c.id === companyIdParam);
      if (company) setCompanyName(company.name);
    } catch (error) {
      console.error("Error fetching company:", error);
    }
  };

  const fetchExistingFile = async (companyIdParam: string) => {
    try {
      const res = await fetch(`/api/files/de-para?companyId=${companyIdParam}`);
      const data = await res.json();
      setExistingFile(data.file || null);
    } catch (error) {
      console.error("Error fetching file:", error);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    const isValid =
      validTypes.includes(file.type) ||
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.name.toLowerCase().endsWith(".xls");

    if (!isValid) {
      setStatusMessage("Formato inválido. Envie um arquivo Excel (.xlsx) ou CSV.");
      setUploadStatus("error");
      return;
    }

    setSelectedFile(file);
    setUploadStatus("idle");
    setStatusMessage("");
  };

  const handleUpload = async () => {
    if (!selectedFile || !companyId) return;

    setUploading(true);
    setUploadStatus("idle");

    try {
      // ✅ Estratégia: Vercel Blob Client Upload (sem AWS keys)
      const safeName = selectedFile.name.replace(/[^\w.\-() ]+/g, "_");
      const folder = `uploads/${companyId}/de-para`;
      const pathname = `${folder}/${Date.now()}-${safeName}`;

      const blob = await upload(pathname, selectedFile, {
        access: "private",
        handleUploadUrl: "/api/upload/presigned",
        contentType:
          selectedFile.type ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Armazena referência no banco: use pathname (estável) como cloudStoragePath
      const cloudStoragePath = blob.pathname;

      const saveRes = await fetch("/api/files/de-para", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          cloudStoragePath,
          fileName: selectedFile.name,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || "Erro ao salvar referência do arquivo");
      }

      if (saveData.overwritten) {
        setUploadStatus("warning");
        setStatusMessage("Arquivo De x Para sobrescrito com sucesso!");
      } else {
        setUploadStatus("success");
        setStatusMessage("Arquivo enviado com sucesso!");
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void fetchExistingFile(companyId);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers =
      "Conta Federação;Descrição Conta Federação;Padrão_BP;Padrão_DRE;Padrão_DFC;Padrão_DMPL";
    const example1 = "1.1.01;Caixa e Equivalentes;0001 - Caixa e Equivalentes de Caixa;;;";
    const example2 = "4.1.01;Receitas de Competições;;0001 - Receitas de Competições;;";
    const example3 = "3.1.01;Custos com Competições;;0050 - Custos com Competições;;";

    const content = `${headers}\n${example1}\n${example2}\n${example3}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_de_para.csv";
    link.click();
    URL.revokeObjectURL(url);
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
            <h1 className="text-2xl font-bold text-gray-800">Upload De x Para</h1>
            <p className="text-gray-500">
              Empresa:{" "}
              <span className="font-medium text-gray-700">
                {companyName || "Carregando..."}
              </span>
            </p>
          </div>
        </div>

        {/* Existing File Warning */}
        {existingFile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800 mb-1">
                  Arquivo existente será sobrescrito
                </h3>
                <p className="text-sm text-amber-700">
                  Arquivo atual: <strong>{existingFile.name}</strong>
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Enviado por {existingFile.uploadedBy.name || existingFile.uploadedBy.email} em{" "}
                  {new Date(existingFile.updatedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
                O arquivo deve conter o mapeamento das contas da federação para o plano padrão:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span className="bg-blue-100 px-2 py-1 rounded">Conta Federação</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Descrição Conta</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Padrão_BP</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Padrão_DRE</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Padrão_DFC</span>
                <span className="bg-blue-100 px-2 py-1 rounded">Padrão_DMPL</span>
              </div>
              <p className="text-xs text-blue-600 mt-3">
                Cada conta da federação deve ser mapeada para pelo menos uma demonstração padrão.
              </p>
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
            className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>Enviando...</>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                {existingFile ? "Sobrescrever De x Para" : "Enviar De x Para"}
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}