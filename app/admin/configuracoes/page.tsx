"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Settings,
  ArrowLeft,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";

const standardFiles = [
  { type: "BP", name: "Balanço Patrimonial", description: "Estrutura padrão do Balanço Patrimonial" },
  { type: "DRE", name: "DRE", description: "Estrutura padrão da Demonstração do Resultado" },
  { type: "DFC", name: "DFC", description: "Estrutura padrão da Demonstração dos Fluxos de Caixa" },
  { type: "DMPL", name: "DMPL", description: "Estrutura padrão das Mutações do PL" },
];

export default function AdminConfiguracoesPage() {
  const router = useRouter();
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: "idle" | "uploading" | "success" | "error" }>({});

  const handleFileUpload = async (type: string, file: File) => {
    setUploadStatus((prev) => ({ ...prev, [type]: "uploading" }));

    try {
      // 1. Get presigned URL
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          isPublic: false,
        }),
      });

      const { uploadUrl, cloudStoragePath } = await presignedRes.json();

      // 2. Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: file,
      });

      // 3. Save standard file reference
      await fetch("/api/admin/standard-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: file.name,
          cloudStoragePath,
        }),
      });

      setUploadStatus((prev) => ({ ...prev, [type]: "success" }));
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus((prev) => ({ ...prev, [type]: "error" }));
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
            <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
            <p className="text-gray-500">Gerencie os arquivos padrões do sistema</p>
          </div>
        </div>

        {/* Standard Files Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold">Arquivos Padrões das Demonstrações</h2>
          </div>

          <p className="text-gray-500 mb-6">
            Faça upload das estruturas padrões que serão utilizadas para o mapeamento De x Para.
          </p>

          <div className="space-y-4">
            {standardFiles.map((sf) => (
              <div
                key={sf.type}
                className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-500 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800">{sf.name}</h3>
                    <p className="text-sm text-gray-500">{sf.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {uploadStatus[sf.type] === "success" && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Atualizado
                    </span>
                  )}
                  {uploadStatus[sf.type] === "error" && (
                    <span className="flex items-center gap-1 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Erro
                    </span>
                  )}

                  <button
                    onClick={() => window.open(`/api/admin/standard-files/${sf.type}/download`, "_blank")}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                    title="Download atual"
                  >
                    <Download className="w-5 h-5" />
                  </button>

                  <input
                    type="file"
                    ref={(el) => { fileInputRefs.current[sf.type] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(sf.type, file);
                    }}
                    accept=".xlsx,.xls"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRefs.current[sf.type]?.click()}
                    disabled={uploadStatus[sf.type] === "uploading"}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadStatus[sf.type] === "uploading" ? "Enviando..." : "Atualizar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
