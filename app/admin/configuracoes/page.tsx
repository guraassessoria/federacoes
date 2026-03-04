"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from '@/lib/constants';
import {
  Upload,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowLeft,
  Eye,
  Trash2,
  Info,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Types ──────────────────────────────────────────────────

type StructureType = "BP" | "DRE" | "DFC" | "DMPL";

type StructureRow = {
  ordem: number;
  codigo: string;
  descricao: string;
  codigoSuperior: string | null;
  nivel: number | null;
  isTotal: boolean;
  grupo: string | null;
};

type StructureData = {
  type: string;
  version: number;
  rows: StructureRow[];
  meta: {
    originalFileName?: string;
    uploadedAt?: string;
    totalRows?: number;
  } | null;
  updatedAt?: string;
};

const TYPES: { type: StructureType; label: string; description: string }[] = [
  { type: "BP", label: "Balanço Patrimonial", description: "Estrutura do BP" },
  { type: "DRE", label: "DRE", description: "Demonstração do Resultado" },
  { type: "DFC", label: "DFC", description: "Demonstração dos Fluxos de Caixa" },
  { type: "DMPL", label: "DMPL", description: "Mutações do Patrimônio Líquido" },
];

// ─── Flexible parser (same logic as backend, for preview) ───

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findKey(keys: string[], candidates: string[]): string | null {
  const normKeys = keys.map((k) => ({ k, nk: norm(k) }));
  for (const c of candidates) {
    const nc = norm(c);
    const hit = normKeys.find((x) => x.nk === nc);
    if (hit) return hit.k;
  }
  for (const c of candidates) {
    const nc = norm(c);
    const hit = normKeys.find((x) => x.nk.includes(nc) || nc.includes(x.nk));
    if (hit) return hit.k;
  }
  return null;
}

function parseBoolean(v: any): boolean {
  if (typeof v === "boolean") return v;
  const s = (v ?? "").toString().trim().toLowerCase();
  return ["1", "true", "sim", "yes", "y", "s"].includes(s);
}

function parseFileToRows(rawRows: Record<string, any>[]): StructureRow[] {
  if (!rawRows.length) return [];

  const keys = Object.keys(rawRows[0]);
  const kCodigo = findKey(keys, ["codigo", "código", "code", "conta", "cod", "conta_padrao"]);
  const kDescricao = findKey(keys, ["descricao", "descrição", "description", "nome", "name"]);
  const kSuperior = findKey(keys, [
    "codigoSuperior", "códigoSuperior", "contaSuperior", "pai",
    "parent", "parentCode", "parentcode", "codPai", "parent_code",
  ]);
  const kNivel = findKey(keys, ["nivelVisualizacao", "nivel_visualizacao", "nivel", "nível", "level", "depth"]);
  const kOrdem = findKey(keys, ["ordem", "order", "sequencia", "sequência", "seq"]);
  const kTotal = findKey(keys, ["isTotal", "is_total", "total", "subtotal"]);
  const kGrupo = findKey(keys, ["grupo", "group", "categoria"]);

  if (!kCodigo || !kDescricao) {
    throw new Error("Colunas 'codigo' e 'descricao' são obrigatórias.");
  }

  const rows: StructureRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const codigo = String(r[kCodigo] ?? "").trim();
    const descricao = String(r[kDescricao] ?? "").trim();
    if (!codigo || !descricao) continue;

    if (seen.has(codigo)) {
      throw new Error(`Código duplicado na linha ${i + 2}: "${codigo}"`);
    }
    seen.add(codigo);

    const ordemRaw = kOrdem ? Number(String(r[kOrdem] ?? "").replace(",", ".")) : NaN;
    const nivelRaw = kNivel ? Number(String(r[kNivel] ?? "").replace(",", ".")) : NaN;

    rows.push({
      ordem: Number.isFinite(ordemRaw) ? ordemRaw : i + 1,
      codigo,
      descricao,
      codigoSuperior: kSuperior ? (String(r[kSuperior] ?? "").trim() || null) : null,
      nivel: Number.isFinite(nivelRaw) ? nivelRaw : null,
      isTotal: kTotal ? parseBoolean(r[kTotal]) : false,
      grupo: kGrupo ? (String(r[kGrupo] ?? "").trim() || null) : null,
    });
  }

  rows.sort((a, b) => a.ordem - b.ordem);
  return rows;
}

// ─── Component ──────────────────────────────────────────────

export default function EstruturasPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeType, setActiveType] = useState<StructureType>("BP");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<StructureRow[]>([]);
  const [previewError, setPreviewError] = useState<string>("");

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const [data, setData] = useState<StructureData>({
    type: "BP",
    version: 0,
    rows: [],
    meta: null,
  });

  // ── Summary of all types ──
  const [summary, setSummary] = useState<
    { type: string; version: number; updatedAt: string }[]
  >([]);

  // ── Fetch summary on mount ──
  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN_STANDARD_FILES, { cache: "no-store" });
      const json = await res.json();
      if (json.structures) setSummary(json.structures);
    } catch (e) {
      console.error(e);
    }
  };

  // ── Fetch active structure when tab changes ──
  useEffect(() => {
    fetchStructure(activeType);
    setSelectedFile(null);
    setPreviewRows([]);
    setPreviewError("");
    setStatus("idle");
    setMessage("");
  }, [activeType]);

  const fetchStructure = async (type: StructureType) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.ADMIN_STANDARD_FILES}?type=${type}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao buscar");
      setData(json);
    } catch (e: any) {
      setData({ type, version: 0, rows: [], meta: null });
    } finally {
      setLoading(false);
    }
  };

  // ── File selection + local preview ──
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setPreviewError("");
    setStatus("idle");
    setMessage("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const isXlsx =
        file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

      let rawRows: Record<string, any>[];

      if (isXlsx) {
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else {
        const text = new TextDecoder("utf-8").decode(arrayBuffer);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("Arquivo vazio");
        const sep = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(sep).map((h) => h.trim());
        rawRows = lines.slice(1).map((row) => {
          const cols = row.split(sep);
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
          return obj;
        });
      }

      const rows = parseFileToRows(rawRows);
      setPreviewRows(rows);
    } catch (e: any) {
      setPreviewRows([]);
      setPreviewError(e?.message || "Erro ao ler arquivo");
    }
  };

  // ── Upload to server ──
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setStatus("idle");
    setMessage("");

    try {
      const form = new FormData();
      form.append("type", activeType);
      form.append("file", selectedFile);

      const res = await fetch(API_ENDPOINTS.ADMIN_STANDARD_FILES, {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha no upload");

      setStatus("success");
      setMessage(
        `Estrutura ${activeType} atualizada! Versão ${json.version} — ${json.totalRows} linhas.`
      );
      setSelectedFile(null);
      setPreviewRows([]);

      // Refresh data
      await fetchStructure(activeType);
      await fetchSummary();
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  // ── Download active saved version ──
  const downloadActiveStructure = async () => {
    if (!data.version) return;

    setDownloading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await fetch(
        `${API_ENDPOINTS.ADMIN_STANDARD_FILES}?type=${activeType}&download=1&format=csv`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        let errorMessage = "Erro ao baixar estrutura";
        try {
          const json = await res.json();
          errorMessage = json?.error || errorMessage;
        } catch {
          // noop
        }
        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
      const fileName = fileNameMatch?.[1] || `estrutura_${activeType.toLowerCase()}_v${data.version}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message || "Erro ao baixar estrutura ativa");
    } finally {
      setDownloading(false);
    }
  };

  // ── Template CSV download ──
  const downloadTemplate = () => {
    const header = "ordem;codigo;descricao;codigoSuperior;nivel;isTotal;grupo";
    const ex1 = "1;1;ATIVO;;1;false;";
    const ex2 = "2;1.1;Ativo Circulante;1;2;false;";
    const ex3 = "3;1.1.01;Caixa e Equivalentes de Caixa;1.1;3;false;";
    const ex4 = "4;1.1.01.01;Caixa;1.1.01;4;false;";
    const ex5 = "5;1.1.01.02;Bancos;1.1.01;4;false;";
    const ex6 = "6;1.1;TOTAL ATIVO CIRCULANTE;1;2;true;";

    const content = [header, ex1, ex2, ex3, ex4, ex5, ex6].join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_estrutura_${activeType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Rows to show (preview if file selected, otherwise saved) ──
  const displayRows = previewRows.length > 0 ? previewRows : data.rows;
  const isPreviewMode = previewRows.length > 0;
  const MAX_DISPLAY = 300;

  const getTypeInfo = (type: string) => summary.find((s) => s.type === type);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow p-6"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-7 h-7 text-[#08C97D]" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Estruturas Padrão das Demonstrações
                  </h1>
                  <p className="text-sm text-slate-500">
                    Base global para todas as empresas — editável via XLSX/CSV
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => fetchStructure(activeType)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all text-sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow p-2 flex gap-2 flex-wrap">
          {TYPES.map((t) => {
            const info = getTypeInfo(t.type);
            return (
              <button
                key={t.type}
                onClick={() => setActiveType(t.type)}
                className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                  activeType === t.type
                    ? "bg-[#08C97D] text-[#13161C] shadow-md"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="font-semibold">{t.label}</div>
                {info && info.version > 0 ? (
                  <div
                    className={`text-xs mt-0.5 ${
                      activeType === t.type ? "text-[#145A3D]" : "text-slate-400"
                    }`}
                  >
                    v{info.version}
                  </div>
                ) : (
                  <div
                    className={`text-xs mt-0.5 ${
                      activeType === t.type ? "text-[#145A3D]" : "text-amber-500"
                    }`}
                  >
                    Não configurado
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Panel */}
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#08C97D]" />
              Upload da Estrutura
            </h2>

            {/* Info */}
            <div className="bg-[#F7FDFC] border border-[#B8EED8] rounded-xl p-3 text-sm text-[#2C5D47]">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Formatos aceitos: XLSX ou CSV</p>
                  <p className="text-[#3B6F56] text-xs">
                    Colunas: <code className="bg-[#DDF7EB] px-1 rounded">codigo</code>,{" "}
                    <code className="bg-[#DDF7EB] px-1 rounded">descricao</code>,{" "}
                    <code className="bg-[#DDF7EB] px-1 rounded">codigoSuperior</code>,{" "}
                    <code className="bg-[#DDF7EB] px-1 rounded">nivel</code>,{" "}
                    <code className="bg-[#DDF7EB] px-1 rounded">ordem</code>,{" "}
                    <code className="bg-[#DDF7EB] px-1 rounded">isTotal</code>
                  </p>
                  <p className="text-[#2C5D47] text-xs mt-1">
                    Também aceita nomes em inglês: code, description, parentCode, etc.
                  </p>
                </div>
              </div>
            </div>

            {/* Download template */}
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 text-[#08C97D] hover:text-[#07B670] text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Baixar template CSV de exemplo
            </button>

            <button
              onClick={downloadActiveStructure}
              disabled={!data.version || loading || downloading || isPreviewMode}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isPreviewMode
                  ? "Finalize ou limpe o preview para baixar a versão ativa salva"
                  : undefined
              }
            >
              <Download className={`w-4 h-4 ${downloading ? "animate-pulse" : ""}`} />
              {downloading ? "Baixando versão ativa..." : `Baixar versão ativa (${activeType})`}
            </button>

            {/* File input area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                selectedFile
                  ? "border-[#08C97D] bg-[#F7FDFC]"
                  : "border-slate-300 hover:border-[#08C97D] hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />

              {selectedFile ? (
                <div>
                  <FileSpreadsheet className="w-10 h-10 text-[#08C97D] mx-auto mb-2" />
                  <p className="font-semibold text-slate-800 text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {previewRows.length > 0
                      ? `${previewRows.length} linhas detectadas`
                      : "Processando..."}
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Clique para selecionar arquivo</p>
                  <p className="text-xs text-slate-400 mt-1">XLSX ou CSV</p>
                </div>
              )}
            </div>

            {/* Preview error */}
            {previewError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{previewError}</p>
              </div>
            )}

            {/* Clear file */}
            {selectedFile && (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewRows([]);
                  setPreviewError("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
              >
                <Trash2 className="w-3 h-3" />
                Limpar seleção
              </button>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading || previewRows.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#08C97D] text-[#13161C] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0AE18C] transition-all"
            >
              <Upload className="w-5 h-5" />
              {uploading ? "Enviando..." : "Publicar nova versão"}
            </button>

            {/* Status messages */}
            <AnimatePresence>
              {status === "success" && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-200"
                >
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-800">{message}</p>
                </motion.div>
              )}
              {status === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Current version info */}
            {data.version > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Versão Atual</h3>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>
                    Versão: <span className="font-semibold text-slate-800">{data.version}</span>
                  </p>
                  <p>
                    Linhas: <span className="font-semibold text-slate-800">{data.rows.length}</span>
                  </p>
                  {data.meta?.originalFileName && (
                    <p>
                      Arquivo:{" "}
                      <span className="font-medium text-slate-700">
                        {data.meta.originalFileName}
                      </span>
                    </p>
                  )}
                  {data.updatedAt && (
                    <p>
                      Atualizado:{" "}
                      <span className="text-slate-700">
                        {new Date(data.updatedAt).toLocaleString("pt-BR")}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview / Data Table */}
          <div className="bg-white rounded-2xl shadow p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-slate-600" />
                  {isPreviewMode ? "Preview do Arquivo" : "Estrutura Salva"}
                </h2>
                <p className="text-sm text-slate-500">
                  {activeType} —{" "}
                  {isPreviewMode ? (
                    <span className="text-amber-600 font-medium">
                      {previewRows.length} linhas (não salvo ainda)
                    </span>
                  ) : (
                    <span>
                      Versão {data.version || "—"} — {data.rows.length} linhas
                    </span>
                  )}
                </p>
              </div>

              {isPreviewMode && (
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                  PREVIEW
                </span>
              )}
            </div>

            <div className="overflow-auto border rounded-xl max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-semibold w-16">#</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-semibold">Código</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-semibold">Descrição</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-semibold">Pai</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-semibold w-16">Nível</th>
                    <th className="text-left px-3 py-2.5 text-slate-600 font-semibold w-16">Total?</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Carregando...
                      </td>
                    </tr>
                  ) : displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                        <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>Nenhuma estrutura configurada para {activeType}.</p>
                        <p className="text-xs mt-1">
                          Faça upload de um arquivo XLSX ou CSV para começar.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayRows.slice(0, MAX_DISPLAY).map((row, idx) => (
                      <tr
                        key={`${row.codigo}-${idx}`}
                        className={`border-t transition-colors ${
                          row.isTotal
                            ? "bg-[#F7FDFC] font-semibold"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 text-xs">{row.ordem}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.codigo}</td>
                        <td
                          className="px-3 py-2"
                          style={{
                            paddingLeft: row.nivel
                              ? `${Math.min((row.nivel - 1) * 16 + 12, 80)}px`
                              : undefined,
                          }}
                        >
                          {row.descricao}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {row.codigoSuperior ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">{row.nivel ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {row.isTotal ? (
                            <span className="inline-block w-5 h-5 bg-[#DDF7EB] text-[#2C5D47] rounded text-xs leading-5 font-bold">
                              T
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {displayRows.length > MAX_DISPLAY && (
                <div className="p-3 text-xs text-slate-500 bg-slate-50 border-t">
                  Exibindo {MAX_DISPLAY} de {displayRows.length} linhas.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-slate-400 text-center">
          Governança: cada upload cria uma <b>nova versão</b>. Estruturas são globais e
          servem como base para todas as empresas.
        </div>
      </div>
    </div>
  );
}
