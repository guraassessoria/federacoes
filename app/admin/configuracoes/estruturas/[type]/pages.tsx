"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type StructureType = "BP" | "DRE" | "DFC" | "DMPL";

type Row = {
  codigo: string;
  descricao: string;
  codigoSuperior: string | null;
  nivelVisualizacao?: number; // opcional
  ordem?: number;            // opcional
};

function normalizeCode(v: any) {
  const s = String(v ?? "").trim();
  return s;
}

function normalizeParent(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/**
 * Esperado no arquivo (XLSX ou CSV), com cabeçalhos:
 * codigo | descricao | codigoSuperior | nivelVisualizacao | ordem
 *
 * Você pode ter variações de nome (ex: "Código", "Descricao", etc).
 * O parser tenta mapear automaticamente.
 */
function parseRowsFromSheet(rows: any[]): Row[] {
  if (!rows || rows.length === 0) return [];

  const keys = Object.keys(rows[0] ?? {});
  const findKey = (candidates: string[]) => {
    const normalized = keys.map((k) => ({ k, nk: k.toLowerCase().replace(/[^a-z0-9]/g, "") }));
    for (const cand of candidates) {
      const nc = cand.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hit = normalized.find((x) => x.nk === nc);
      if (hit) return hit.k;
    }
    // fallback: includes
    for (const cand of candidates) {
      const nc = cand.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hit = normalized.find((x) => x.nk.includes(nc) || nc.includes(x.nk));
      if (hit) return hit.k;
    }
    return null;
  };

  const kCodigo = findKey(["codigo", "código", "code", "conta", "conta_padrao"]);
  const kDescricao = findKey(["descricao", "descrição", "description", "nome"]);
  const kSuperior = findKey(["codigoSuperior", "códigoSuperior", "contasuperior", "pai", "parent", "codigosuperior"]);
  const kNivelVis = findKey(["nivelVisualizacao", "nivel_visualizacao", "nivel", "nível"]);
  const kOrdem = findKey(["ordem", "order", "sequencia", "sequência"]);

  if (!kCodigo || !kDescricao) {
    throw new Error("Arquivo inválido: precisa ter pelo menos colunas 'codigo' e 'descricao'.");
  }

  const parsed: Row[] = rows
    .map((r: any) => {
      const codigo = normalizeCode(r[kCodigo]);
      const descricao = String(r[kDescricao] ?? "").trim();
      const codigoSuperior = kSuperior ? normalizeParent(r[kSuperior]) : null;

      const nivelVisualizacao =
        kNivelVis && r[kNivelVis] !== undefined && r[kNivelVis] !== null && String(r[kNivelVis]).trim() !== ""
          ? Number(r[kNivelVis])
          : undefined;

      const ordem =
        kOrdem && r[kOrdem] !== undefined && r[kOrdem] !== null && String(r[kOrdem]).trim() !== ""
          ? Number(r[kOrdem])
          : undefined;

      return { codigo, descricao, codigoSuperior, nivelVisualizacao, ordem };
    })
    .filter((r) => r.codigo && r.descricao);

  // sanity: códigos duplicados
  const seen = new Set<string>();
  for (const r of parsed) {
    if (seen.has(r.codigo)) {
      throw new Error(`Código duplicado na estrutura: ${r.codigo}`);
    }
    seen.add(r.codigo);
  }

  return parsed;
}

export default function EstruturaTypePage() {
  const router = useRouter();
  const params = useParams();
  const type = (params?.type as string | undefined)?.toUpperCase() as StructureType | undefined;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [preview, setPreview] = useState<Row[]>([]);

  const isValidType = useMemo(() => ["BP", "DRE", "DFC", "DMPL"].includes(type ?? ""), [type]);

  useEffect(() => {
    if (!isValidType) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/standard-files?type=${type}`);
        const data = await res.json();
        setCurrentVersion(data?.version ?? 0);

        // Preview: se tiver salvo no banco, tenta mostrar as primeiras linhas
        const savedRows = data?.data?.rows as Row[] | undefined;
        if (Array.isArray(savedRows)) setPreview(savedRows.slice(0, 20));
      } catch (e) {
        console.error(e);
      }
    };

    load();
  }, [type, isValidType]);

  if (!isValidType) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-700 font-semibold">Tipo inválido. Use: BP, DRE, DFC, DMPL.</p>
        </div>
      </div>
    );
  }

  const readFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const rows = parseRowsFromSheet(json as any[]);
    return rows;
  };

  const handleSelect = async (f: File) => {
    setSelectedFile(f);
    setStatus("idle");
    setMessage("");

    try {
      const rows = await readFile(f);
      setPreview(rows.slice(0, 20));
      setMessage(`Preview OK: ${rows.length} linhas detectadas.`);
      setStatus("success");
    } catch (e: any) {
      setPreview([]);
      setStatus("error");
      setMessage(e?.message ?? "Erro ao ler arquivo.");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const rows = await readFile(selectedFile);

      const payload = {
        type,
        data: {
          rows,
          meta: {
            originalFileName: selectedFile.name,
            uploadedAt: new Date().toISOString(),
          },
        },
      };

      const res = await fetch("/api/admin/standard-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json();

      if (!res.ok) throw new Error(out?.error || "Falha ao salvar estrutura");

      setCurrentVersion(out.version ?? currentVersion + 1);
      setStatus("success");
      setMessage(`Estrutura ${type} atualizada com sucesso. Versão: ${out.version}`);
      setSelectedFile(null);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-lg transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Estrutura Padrão - {type}</h1>
            <p className="text-gray-500">Versão atual: <span className="font-semibold text-gray-700">{currentVersion}</span></p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow p-6">
          <div className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-blue-50 transition-all"
               onClick={() => document.getElementById("fileInput")?.click()}>
            <input
              id="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSelect(f);
              }}
            />

            <FileSpreadsheet className="w-14 h-14 text-blue-600 mx-auto mb-3" />
            <p className="font-semibold text-gray-800">Clique para selecionar o XLSX/CSV</p>
            <p className="text-sm text-gray-500 mt-1">Cabeçalhos esperados: codigo, descricao, codigoSuperior, nivelVisualizacao, ordem</p>

            {selectedFile && (
              <div className="mt-4 text-sm text-gray-700">
                Arquivo: <span className="font-semibold">{selectedFile.name}</span>
              </div>
            )}
          </div>

          {status !== "idle" && (
            <div className={`mt-4 p-3 rounded-lg border flex items-center gap-2 ${
              status === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}>
              {status === "success" ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <p className={status === "success" ? "text-green-700" : "text-red-700"}>{message}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading || status === "error"}
            className="mt-5 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Salvar Estrutura {type}
              </>
            )}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Preview (primeiras 20 linhas)</h2>
          {preview.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum preview disponível.</p>
          ) : (
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-left px-3 py-2">Superior</th>
                    <th className="text-left px-3 py-2">Nível</th>
                    <th className="text-left px-3 py-2">Ordem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.codigo} className="border-t">
                      <td className="px-3 py-2">{r.codigo}</td>
                      <td className="px-3 py-2">{r.descricao}</td>
                      <td className="px-3 py-2">{r.codigoSuperior ?? "-"}</td>
                      <td className="px-3 py-2">{r.nivelVisualizacao ?? "-"}</td>
                      <td className="px-3 py-2">{r.ordem ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}