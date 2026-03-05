"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Database,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Download,
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/constants";
import { useDashboard } from "@/lib/contexts/DashboardContext";

type UploadStatus = "idle" | "success" | "warning" | "error";

interface CompanyFile {
  id: string;
  type: string;
  name: string;
  period: string | null;
  updatedAt: string;
}

const STRUCTURE_TYPES = ["BP", "DRE", "DFC", "DMPL", "DRA"] as const;
type StructureType = (typeof STRUCTURE_TYPES)[number];

interface StandardStructureRow {
  ordem?: number;
  codigo?: string;
  descricao?: string;
  codigoSuperior?: string | null;
  nivel?: number | null;
  isTotal?: boolean;
  grupo?: string | null;
}

interface StandardStructureResponse {
  type: StructureType;
  version: number;
  rows: StandardStructureRow[];
}

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
  const yy = year.slice(-2);
  return `${mon}/${yy}`;
}

export default function GerenciamentoDadosPage() {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role as string | undefined;
  const router = useRouter();
  const { selectedCompanyId, selectedCompanyName } = useDashboard();

  const balanceteInputRef = useRef<HTMLInputElement>(null);
  const deParaInputRef = useRef<HTMLInputElement>(null);
  const previousCompanyIdRef = useRef<string>("");

  const [companyId, setCompanyId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  const [balancetes, setBalancetes] = useState<CompanyFile[]>([]);
  const [deParaFiles, setDeParaFiles] = useState<CompanyFile[]>([]);

  const [month, setMonth] = useState<string>("JAN");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const period = useMemo(() => formatPeriod(month, year), [month, year]);

  const [selectedBalanceteFile, setSelectedBalanceteFile] = useState<File | null>(null);
  const [selectedDeParaFile, setSelectedDeParaFile] = useState<File | null>(null);

  const [uploadingBalancete, setUploadingBalancete] = useState(false);
  const [uploadingDePara, setUploadingDePara] = useState(false);

  const [balanceteStatus, setBalanceteStatus] = useState<UploadStatus>("idle");
  const [balanceteMessage, setBalanceteMessage] = useState("");

  const [deParaStatus, setDeParaStatus] = useState<UploadStatus>("idle");
  const [deParaMessage, setDeParaMessage] = useState("");

  const canUpload = useMemo(() => {
    if (!session?.user) return false;
    return role === "ADMIN" || role === "EDITOR";
  }, [session?.user, role]);

  useEffect(() => {
    const currentCompanyId = selectedCompanyId || localStorage.getItem("selectedCompany") || "";
    const currentCompanyName = selectedCompanyName || localStorage.getItem("selectedCompanyName") || "";

    if (!currentCompanyId) {
      setCompanyId("");
      setCompanyName("");
      setBalancetes([]);
      setDeParaFiles([]);
      return;
    }

    const companyChanged =
      previousCompanyIdRef.current && previousCompanyIdRef.current !== currentCompanyId;

    setCompanyId(currentCompanyId);
    setCompanyName(currentCompanyName);
    fetchFiles(currentCompanyId);

    if (!currentCompanyName) {
      fetchCompanyInfo(currentCompanyId);
    }

    if (companyChanged) {
      setSelectedBalanceteFile(null);
      setSelectedDeParaFile(null);
      setBalanceteStatus("idle");
      setDeParaStatus("idle");
      setBalanceteMessage("");
      setDeParaMessage("");
      if (balanceteInputRef.current) balanceteInputRef.current.value = "";
      if (deParaInputRef.current) deParaInputRef.current.value = "";
    }

    previousCompanyIdRef.current = currentCompanyId;
  }, [selectedCompanyId, selectedCompanyName]);

  const fetchCompanyInfo = async (cid: string) => {
    try {
      const res = await fetch(API_ENDPOINTS.USER_COMPANIES);
      const data = await res.json();
      const company = data.companies?.find((c: { id: string }) => c.id === cid);
      if (company) setCompanyName(company.name);
    } catch (error) {
      console.error("Error fetching company:", error);
    }
  };

  const fetchFiles = async (cid: string) => {
    try {
      const balRes = await fetch(`${API_ENDPOINTS.FILES_BALANCETE}?companyId=${cid}`);
      const balData = await balRes.json();
      setBalancetes(balData.files || []);

      const deParaRes = await fetch(`${API_ENDPOINTS.FILES_DE_PARA}?companyId=${cid}`);
      const deParaData = await deParaRes.json();
      setDeParaFiles(deParaData.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const handleBalanceteSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setBalanceteStatus("error");
      setBalanceteMessage("Formato inválido. Envie Excel (.xlsx) ou CSV (.csv).");
      setSelectedBalanceteFile(null);
      if (balanceteInputRef.current) balanceteInputRef.current.value = "";
      return;
    }

    setSelectedBalanceteFile(file);
    setBalanceteStatus("idle");
    setBalanceteMessage("");
  };

  const handleDeParaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setDeParaStatus("error");
      setDeParaMessage("Formato inválido. Envie Excel (.xlsx) ou CSV (.csv).");
      setSelectedDeParaFile(null);
      if (deParaInputRef.current) deParaInputRef.current.value = "";
      return;
    }

    setSelectedDeParaFile(file);
    setDeParaStatus("idle");
    setDeParaMessage("");
  };

  const handleUploadBalancete = async () => {
    if (!canUpload) {
      setBalanceteStatus("error");
      setBalanceteMessage("Sem permissão para upload. Apenas ADMIN/EDITOR.");
      return;
    }
    if (!selectedBalanceteFile || !companyId) return;

    setUploadingBalancete(true);
    setBalanceteStatus("idle");
    setBalanceteMessage("");

    try {
      const form = new FormData();
      form.append("companyId", companyId);
      form.append("period", period);
      form.append("file", selectedBalanceteFile);

      const res = await fetch(API_ENDPOINTS.FILES_BALANCETE_UPLOAD, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Erro ao enviar/validar balancete.");
      }

      setBalanceteStatus("success");
      setBalanceteMessage(
        `${data.message || `Balancete ${period} salvo no banco.`} Linhas inseridas: ${data.inserted ?? "-"}; removidas no replace: ${data.deleted ?? "-"}`
      );

      setSelectedBalanceteFile(null);
      if (balanceteInputRef.current) balanceteInputRef.current.value = "";
      fetchFiles(companyId);
    } catch (err: any) {
      console.error("Upload Balancete error:", err);
      setBalanceteStatus("error");
      setBalanceteMessage(err?.message || "Erro desconhecido.");
    } finally {
      setUploadingBalancete(false);
    }
  };

  const handleUploadDePara = async () => {
    if (!canUpload) {
      setDeParaStatus("error");
      setDeParaMessage("Sem permissão para upload. Apenas ADMIN/EDITOR.");
      return;
    }
    if (!selectedDeParaFile || !companyId) return;

    setUploadingDePara(true);
    setDeParaStatus("idle");
    setDeParaMessage("");

    try {
      const form = new FormData();
      form.append("companyId", companyId);
      form.append("file", selectedDeParaFile);

      const res = await fetch(API_ENDPOINTS.FILES_DE_PARA_UPLOAD, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Erro ao enviar/validar De x Para.");
      }

      setDeParaStatus(deParaFiles.length > 0 ? "warning" : "success");
      setDeParaMessage(
        deParaFiles.length > 0
          ? `De x Para atualizado no banco. Linhas inseridas: ${data.inserted}.`
          : `De x Para salvo no banco com sucesso. Linhas inseridas: ${data.inserted}.`
      );

      setSelectedDeParaFile(null);
      if (deParaInputRef.current) deParaInputRef.current.value = "";
      fetchFiles(companyId);
    } catch (err: any) {
      console.error("Upload De-Para error:", err);
      setDeParaStatus("error");
      setDeParaMessage(err?.message || "Erro desconhecido.");
    } finally {
      setUploadingDePara(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const modelHeader = [
        "Conta Federação",
        "Descrição Conta Federação",
        "Padrão_BP",
        "Padrão_DRE",
        "Padrão_DFC",
        "Padrão_DMPL",
      ];

      const modelRows = [
        ["1.1.01", "Caixa e Equivalentes", "0001", "", "", ""],
        ["4.1.01", "Receitas de Competições", "", "0001", "", ""],
        ["3.1.01", "Custos com Competições", "", "0050", "", ""],
      ];

      const modelSheet = XLSX.utils.aoa_to_sheet([modelHeader, ...modelRows]);
      XLSX.utils.book_append_sheet(workbook, modelSheet, "MODELO_DE_PARA");

      const structureResults = await Promise.all(
        STRUCTURE_TYPES.map(async (type) => {
          const res = await fetch(`${API_ENDPOINTS.ADMIN_STANDARD_FILES}?type=${type}`, {
            cache: "no-store",
          });

          if (!res.ok) {
            return null;
          }

          const data = (await res.json()) as StandardStructureResponse;
          if (!Array.isArray(data.rows) || data.rows.length === 0) {
            return null;
          }

          return {
            type,
            version: data.version || 0,
            rows: data.rows,
          };
        })
      );

      structureResults
        .filter((item): item is { type: StructureType; version: number; rows: StandardStructureRow[] } => Boolean(item))
        .forEach((item) => {
          const normalizedRows = item.rows.filter((row) => (row.codigo || "").trim());
          const allCodes = normalizedRows.map((row) => (row.codigo || "").trim());
          const parentCodes = new Set(
            normalizedRows
              .map((row) => (row.codigoSuperior || "").trim())
              .filter(Boolean)
          );

          const analyticalRows = normalizedRows.filter((row) => {
            const code = (row.codigo || "").trim();
            if (!code) return false;

            const hasChildByParent = parentCodes.has(code);
            const hasChildByPrefix = allCodes.some(
              (otherCode) => otherCode !== code && otherCode.startsWith(`${code}.`)
            );

            return !hasChildByParent && !hasChildByPrefix;
          });

          if (analyticalRows.length === 0) {
            return;
          }

          const structureHeader = [
            "ordem",
            "codigo",
            "descricao",
            "codigoSuperior",
            "nivel",
            "isTotal",
            "grupo",
            "versao",
          ];

          const structureRows = analyticalRows.map((row) => [
            row.ordem ?? "",
            row.codigo ?? "",
            row.descricao ?? "",
            row.codigoSuperior ?? "",
            row.nivel ?? "",
            row.isTotal ? "TRUE" : "FALSE",
            row.grupo ?? "",
            item.version,
          ]);

          const structureSheet = XLSX.utils.aoa_to_sheet([structureHeader, ...structureRows]);
          XLSX.utils.book_append_sheet(workbook, structureSheet, item.type);
        });

      XLSX.writeFile(workbook, "modelo_de_para_com_estruturas.xlsx");
    } catch (error) {
      console.error("Erro ao gerar modelo de De x Para:", error);
      setDeParaStatus("error");
      setDeParaMessage("Não foi possível gerar o modelo de De x Para com estruturas.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#08C97D] to-[#07B670] rounded-lg flex items-center justify-center">
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
                  Seu perfil é <strong>{role || "desconhecido"}</strong>. Apenas <strong>ADMIN</strong> e <strong>EDITOR</strong> podem enviar arquivos.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#08C97D] mt-0.5" />
            <div className="w-full">
              <h3 className="font-semibold text-gray-800 mb-2">Upload de Balancete</h3>
              <p className="text-sm text-gray-600 mb-4">
                O balancete é salvo por <strong>empresa + período</strong>. Ao reenviar, o sistema substitui os dados do período.
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

              {selectedBalanceteFile && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-800 text-sm">
                    Atenção: ao enviar, o sistema irá <strong>substituir</strong> os dados do período <strong>{period}</strong> para esta empresa.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            onClick={() => balanceteInputRef.current?.click()}
            className={`mt-6 border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              selectedBalanceteFile
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-[#08C97D] hover:bg-[#F7FDFC]"
            }`}
          >
            <input
              type="file"
              ref={balanceteInputRef}
              onChange={handleBalanceteSelect}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={!canUpload}
            />

            {selectedBalanceteFile ? (
              <>
                <FileSpreadsheet className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-800">{selectedBalanceteFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(selectedBalanceteFile.size / 1024).toFixed(2)} KB</p>
                <p className="text-sm text-green-600 mt-2">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-600">Clique para selecionar o balancete</p>
                <p className="text-sm text-gray-400 mt-1">Formatos aceitos: Excel (.xlsx) ou CSV</p>
              </>
            )}
          </div>

          {balanceteStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700">{balanceteMessage}</p>
            </motion.div>
          )}

          {balanceteStatus === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{balanceteMessage}</p>
            </motion.div>
          )}

          <button
            onClick={handleUploadBalancete}
            disabled={!selectedBalanceteFile || uploadingBalancete || !canUpload}
            className="mt-6 w-full bg-[#08C97D] text-[#13161C] py-3 rounded-lg font-semibold hover:bg-[#0AE18C] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadingBalancete ? (
              <>Enviando...</>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Salvar Balancete no Banco
              </>
            )}
          </button>
        </motion.div>

        {deParaFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800 mb-1">De x Para existente será substituído no banco</h3>
                <p className="text-sm text-amber-700">
                  Arquivo atual: <strong>{deParaFiles[0].name}</strong>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <div className="bg-[#F7FDFC] border border-[#B8EED8] rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-[#08C97D] mt-0.5" />
              <div>
                <h3 className="font-medium text-[#2C5D47] mb-2">Upload de De x Para</h3>
                <p className="text-sm text-[#3B6F56] mb-3">Colunas obrigatórias (com variações aceitas):</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <span className="bg-[#DDF7EB] px-2 py-1 rounded">Conta Federação</span>
                  <span className="bg-[#DDF7EB] px-2 py-1 rounded">Descrição Conta</span>
                  <span className="bg-[#DDF7EB] px-2 py-1 rounded">Padrão_BP</span>
                  <span className="bg-[#DDF7EB] px-2 py-1 rounded">Padrão_DRE</span>
                  <span className="bg-[#DDF7EB] px-2 py-1 rounded">Padrão_DFC</span>
                  <span className="bg-[#DDF7EB] px-2 py-1 rounded">Padrão_DMPL</span>
                </div>

                <button onClick={downloadTemplate} className="mt-4 flex items-center gap-2 text-[#08C97D] hover:text-[#07B670] text-sm font-medium">
                  <Download className="w-4 h-4" />
                  Baixar modelo com estruturas (Excel)
                </button>
              </div>
            </div>
          </div>

          <div
            onClick={() => deParaInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              selectedDeParaFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-[#08C97D] hover:bg-[#F7FDFC]"
            }`}
          >
            <input
              type="file"
              ref={deParaInputRef}
              onChange={handleDeParaSelect}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={!canUpload}
            />

            {selectedDeParaFile ? (
              <>
                <FileSpreadsheet className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-800">{selectedDeParaFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(selectedDeParaFile.size / 1024).toFixed(2)} KB</p>
                <p className="text-sm text-green-600 mt-2">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-600">Clique para selecionar o De x Para</p>
                <p className="text-sm text-gray-400 mt-1">Formatos aceitos: Excel (.xlsx) ou CSV</p>
              </>
            )}
          </div>

          {deParaStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700">{deParaMessage}</p>
            </motion.div>
          )}

          {deParaStatus === "warning" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-amber-700">{deParaMessage}</p>
            </motion.div>
          )}

          {deParaStatus === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{deParaMessage}</p>
            </motion.div>
          )}

          <button
            onClick={handleUploadDePara}
            disabled={!selectedDeParaFile || uploadingDePara || !canUpload}
            className="mt-6 w-full bg-[#08C97D] text-[#13161C] py-3 rounded-lg font-semibold hover:bg-[#0AE18C] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadingDePara ? (
              <>Enviando...</>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Salvar De x Para no Banco
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
