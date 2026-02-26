"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileSpreadsheet, RefreshCw, CheckCircle, AlertCircle, Download } from "lucide-react";

type StructureType = "BP" | "DRE" | "DFC" | "DMPL";

type StructureLine = {
  order: number;
  code: string;
  description: string;
  group?: string | null;
  parentCode?: string | null;
  isTotal: boolean;
};

type StructureResponse = {
  type: string;
  version: number | null;
  lines: StructureLine[];
};

const TYPES: { type: StructureType; label: string }[] = [
  { type: "BP", label: "Balanço Patrimonial (BP)" },
  { type: "DRE", label: "Demonstração do Resultado (DRE)" },
  { type: "DFC", label: "Demonstração do Fluxo de Caixa (DFC)" },
  { type: "DMPL", label: "Demonstração das Mutações do PL (DMPL)" },
];

export default function EstruturasAdminPage() {
  const [activeType, setActiveType] = useState<StructureType>("BP");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const [data, setData] = useState<StructureResponse>({ type: "BP", version: null, lines: [] });

  const templateCsv = useMemo(() => {
    // Headers aceitos: order, code, description, group, parentCode, isTotal
    // Você pode renomear colunas no seu Excel, desde que batam com mapeamento do backend.
    const headers = "order;code;description;group;parentCode;isTotal";
    const example1 = "1;1.01;ATIVO;BP;;true";
    const example2 = "2;1.01.01;Ativo Circulante;BP;1.01;false";
    const example3 = "3;1.01.01.01;Caixa e equivalentes;BP;1.01.01;false";
    return `${headers}\n${example1}\n${example2}\n${example3}\n`;
  }, []);

  const fetchActive = async (type: StructureType) => {
    setLoading(true);
    setStatus("idle");
    setMessage("");
    try {
      const res = await fetch(`/api/structures/${type}`, { cache: "no-store" });
      const json = (await res.json()) as StructureResponse;

      if (!res.ok) throw new Error((json as any).error || "Erro ao buscar estrutura");

      setData(json);
    } catch (e: any) {
      setData({ type, version: null, lines: [] });
      setStatus("error");
      setMessage(e?.message || "Erro ao buscar estrutura");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive(activeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  const onDownloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_estrutura_${activeType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setStatus("idle");
    setMessage("");

    try {
      const form = new FormData();
      form.append("type", activeType);
      form.append("file", selectedFile);

      const res = await fetch("/api/structures/upload", {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Falha no upload");

      setStatus("success");
      setMessage(`Estrutura ${activeType} atualizada com sucesso. Versão: ${json.version}. Linhas: ${json.totalLines}.`);
      setSelectedFile(null);

      await fetchActive(activeType);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow p-6"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-7 h-7 text-slate-700" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Estruturas Padrão (Globais)</h1>
                <p className="text-sm text-slate-600">
                  BP/DRE/DFC/DMPL editáveis via XLSX/CSV — versionadas e salvas no banco
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchActive(activeType)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </motion.div>

        <div className="bg-white rounded-2xl shadow p-4 flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => setActiveType(t.type)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeType === t.type ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <h2 className="font-bold text-slate-900">Upload da Estrutura</h2>

            <div className="text-sm text-slate-600">
              <p>
                Formatos: <b>XLSX</b> ou <b>CSV</b>.
              </p>
              <p>
                Colunas: <code>order</code>, <code>code</code>, <code>description</code>, <code>group</code>,{" "}
                <code>parentCode</code>, <code>isTotal</code>.
              </p>
            </div>

            <button
              onClick={onDownloadTemplate}
              className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-900 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Baixar template CSV
            </button>

            <div className="border-2 border-dashed rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-slate-700">
                  Selecionado: <b>{selectedFile.name}</b>
                </p>
              )}
            </div>

            <button
              onClick={onUpload}
              disabled={!selectedFile || uploading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              {uploading ? "Enviando..." : "Publicar nova versão"}
            </button>

            {status === "success" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-700 mt-0.5" />
                <p className="text-sm text-green-800">{message}</p>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-700 mt-0.5" />
                <p className="text-sm text-red-800">{message}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="font-bold text-slate-900">Estrutura ativa</h2>
                <p className="text-sm text-slate-600">
                  Tipo: <b>{activeType}</b> — Versão: <b>{data.version ?? "—"}</b> — Linhas:{" "}
                  <b>{data.lines.length}</b>
                </p>
              </div>
            </div>

            <div className="overflow-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2">Order</th>
                    <th className="text-left px-3 py-2">Code</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2">Group</th>
                    <th className="text-left px-3 py-2">Parent</th>
                    <th className="text-left px-3 py-2">Total?</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-600">
                        Carregando...
                      </td>
                    </tr>
                  ) : data.lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-600">
                        Nenhuma estrutura publicada ainda para {activeType}.
                      </td>
                    </tr>
                  ) : (
                    data.lines.slice(0, 200).map((l, idx) => (
                      <tr key={`${l.code}-${idx}`} className="border-t">
                        <td className="px-3 py-2">{l.order}</td>
                        <td className="px-3 py-2 font-mono">{l.code}</td>
                        <td className="px-3 py-2">{l.description}</td>
                        <td className="px-3 py-2">{l.group ?? ""}</td>
                        <td className="px-3 py-2 font-mono">{l.parentCode ?? ""}</td>
                        <td className="px-3 py-2">{l.isTotal ? "Sim" : "Não"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {data.lines.length > 200 && (
                <div className="p-3 text-xs text-slate-500">
                  Exibindo apenas as primeiras 200 linhas (performance). Total real: {data.lines.length}.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Governança: ao subir um arquivo, o sistema cria <b>nova versão</b> e marca as antigas como <b>inativas</b>.
        </div>
      </div>
    </div>
  );
}