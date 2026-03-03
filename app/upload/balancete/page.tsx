"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { API_ENDPOINTS } from '@/lib/constants';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Info,
  AlertTriangle,
} from "lucide-react";

type UploadStatus = "idle" | "success" | "warning" | "error";

function monthOptions() {
  return [
    { label: "JAN", value: "JAN" },
    { label: "FEV", value: "FEV" },
    { label: "MAR", value: "MAR" },
    { label: "ABR", value: "ABR" },
    { label: "MAI", value: "MAI" },
    { label: "JUN", value: "JUN" },
    { label: "JUL", value: "JUL" },
    { label: "AGO", value: "AGO" },
    { label: "SET", value: "SET" },
    { label: "OUT", value: "OUT" },
    { label: "NOV", value: "NOV" },
    { label: "DEZ", value: "DEZ" },
  ];
}

function yearOptions() {
  const now = new Date();
  const y = now.getFullYear();
  return [y - 2, y - 1, y, y + 1].map((n) => String(n));
}

function formatPeriod(mon: string, year: string) {
  // "JAN/2025" -> "JAN/25"
  const yy = year.slice(-2);
  return `${mon}/${yy}`;
}

export default function UploadBalancetePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role as string | undefined;

  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  const [month, setMonth] = useState<string>("JAN");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));

  const period = useMemo(() => formatPeriod(month, year), [month, year]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Se você quiser avisar “já existe balancete para este período”, você pode implementar um GET no futuro.
  // Por ora, a API faz replace-all do período; então o warning é sempre “vai substituir”.
  const [willReplace, setWillReplace] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("selectedCompany");
    if (stored) {
      setCompanyId(stored);
      fetchCompanyInfo(stored);
    }
  }, []);

  useEffect(() => {
    // Como a API substitui o período, é seguro sempre sinalizar isso quando já tiver arquivo selecionado.
    setWillReplace(Boolean(selectedFile));
  }, [selectedFile, period]);

  const fetchCompanyInfo = async (cid: string) => {
    try {
      const res = await fetch(API_ENDPOINTS.USER_COMPANIES);
      const data = await res.json();
      const company = data.companies?.find((c: { id: string }) => c.id === cid);
      if (company) setCompanyName(company.name);
    } catch (err) {
      console.error("Error fetching company info:", err);
    }
  };

  const canUpload = useMemo(() => {
    if (!session?.user) return false;
    // Tela bloqueia “CONSULTA”, mas a regra final é no backend.
    return role === "ADMIN" || role === "EDITOR";
  }, [session?.user, role]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    const okExt = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".csv");
    const okType = validTypes.includes(file.type);

    if (!okType && !okExt) {
      setUploadStatus("error");
      setStatusMessage("Formato inválido. Envie Excel (.xlsx) ou CSV (.csv).");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadStatus("idle");
    setStatusMessage("");
  };

  const handleUpload = async () => {
    if (!canUpload) {
      setUploadStatus("error");
      setStatusMessage("Sem permissão para upload. Apenas ADMIN/EDITOR.");
      return;
    }
    if (!selectedFile || !companyId) return;

    setUploading(true);
    setUploadStatus("idle");
    setStatusMessage("");

    try {
      const form = new FormData();
      form.append("companyId", companyId);
      form.append("period", period);
      form.append("file", selectedFile);

      const res = await fetch(API_ENDPOINTS.FILES_BALANCETE_UPLOAD, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao enviar/validar balancete.");
      }

      // A estratégia é replace-all do período: sempre trate como “warning” se já havia algo.
      setUploadStatus("success");
      setStatusMessage(
        `${data.message || `Balancete ${period} salvo no banco.`} Linhas inseridas: ${data.inserted ?? "-"}; removidas no replace: ${data.deleted ?? "-"}`
      );

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setWillReplace(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadStatus("error");
      setStatusMessage(err?.message || "Erro desconhecido.");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">Carregando sessão...</div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <p className="text-gray-800 font-semibold">Você precisa estar logado para acessar esta página.</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Ir para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Upload Balancete</h1>
            <p className="text-gray-500">
              Empresa: <span className="font-medium text-gray-700">{companyName || "Carregando..."}</span>
            </p>
          </div>
        </div>

        {/* Permission Banner */}
        {!canUpload && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 mb-1">Acesso restrito</h3>
                <p className="text-sm text-red-700">
                  Seu perfil é <strong>{role || "desconhecido"}</strong>. Apenas <strong>ADMIN</strong> e <strong>EDITOR</strong> podem enviar balancetes.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Period Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="w-full">
              <h3 className="font-semibold text-gray-800 mb-2">Período de referência</h3>
              <p className="text-sm text-gray-600 mb-4">
                O balancete será salvo no banco por <strong>empresa + período</strong>. Ao reenviar, o sistema faz <strong>replace</strong> do período.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Mês</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    {monthOptions().map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Ano</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                  >
                    {yearOptions().map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="w-full border rounded-lg px-3 py-2 bg-gray-50">
                    <div className="text-xs text-gray-500">Período</div>
                    <div className="font-semibold text-gray-800">{period}</div>
                  </div>
                </div>
              </div>

              {willReplace && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-800 text-sm">
                    Atenção: ao enviar, o sistema irá <strong>substituir</strong> os dados do período <strong>{period}</strong> para esta empresa.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-8"
        >
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
              disabled={!canUpload}
            />

            {selectedFile ? (
              <>
                <FileSpreadsheet className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                <p className="text-sm text-green-600 mt-2">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-600">
                  Clique para selecionar o balancete
                </p>
                <p className="text-sm text-gray-400 mt-1">Formatos aceitos: Excel (.xlsx) ou CSV</p>
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

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading || !canUpload}
            className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>Enviando...</>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Salvar Balancete no Banco
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}