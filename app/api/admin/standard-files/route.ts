import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { invalidateEstruturaCache } from "@/lib/services/estruturaMapping";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["BP", "DRE", "DFC", "DMPL", "DRA"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

// ─── Helpers ────────────────────────────────────────────────

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

function parseNumber(v: any): number | undefined {
  if (v === null || v === undefined || String(v).trim() === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

type StructureRow = {
  ordem: number;
  codigo: string;
  descricao: string;
  codigoSuperior: string | null;
  nivel: number | null;
  isTotal: boolean;
  grupo: string | null;
};

function descricaoPathByCodigo(rows: StructureRow[]): Map<string, string> {
  const byCodigo = new Map<string, StructureRow>();
  rows.forEach((row) => byCodigo.set(row.codigo, row));

  const cache = new Map<string, string>();

  const normDesc = (v: string) =>
    (v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const build = (codigo: string, stack = new Set<string>()): string => {
    if (cache.has(codigo)) return cache.get(codigo)!;
    const row = byCodigo.get(codigo);
    if (!row) return "";

    if (stack.has(codigo)) return normDesc(row.descricao);
    stack.add(codigo);

    const parent = row.codigoSuperior ? byCodigo.get(row.codigoSuperior) : null;
    const parentPath = parent ? build(parent.codigo, stack) : "";
    const current = normDesc(row.descricao);
    const path = parentPath ? `${parentPath}>${current}` : current;

    cache.set(codigo, path);
    stack.delete(codigo);
    return path;
  };

  rows.forEach((row) => build(row.codigo));
  return cache;
}

function buildCodeAliases(
  previousRows: StructureRow[],
  nextRows: StructureRow[],
  existingAliases: Record<string, string>
): Record<string, string> {
  const oldPath = descricaoPathByCodigo(previousRows);
  const newPath = descricaoPathByCodigo(nextRows);

  const oldCodeByPath = new Map<string, string>();
  oldPath.forEach((path, code) => {
    if (!oldCodeByPath.has(path)) oldCodeByPath.set(path, code);
  });

  const newCodeByPath = new Map<string, string>();
  newPath.forEach((path, code) => {
    if (!newCodeByPath.has(path)) newCodeByPath.set(path, code);
  });

  const directAliases: Record<string, string> = {};
  oldCodeByPath.forEach((oldCode, pathKey) => {
    const newCode = newCodeByPath.get(pathKey);
    if (newCode && newCode !== oldCode) {
      directAliases[oldCode] = newCode;
    }
  });

  const merged: Record<string, string> = { ...(existingAliases || {}) };

  for (const [oldCode, mappedCode] of Object.entries(merged)) {
    if (directAliases[mappedCode]) {
      merged[oldCode] = directAliases[mappedCode];
    }
  }

  for (const [oldCode, newCode] of Object.entries(directAliases)) {
    merged[oldCode] = newCode;
  }

  const collapsed: Record<string, string> = {};
  for (const [fromCode, toCode] of Object.entries(merged)) {
    let current = toCode;
    const seen = new Set<string>([fromCode]);
    while (merged[current] && !seen.has(current)) {
      seen.add(current);
      current = merged[current];
    }
    if (fromCode !== current) {
      collapsed[fromCode] = current;
    }
  }

  return collapsed;
}

function parseCsv(content: string): Record<string, any>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((row) => {
    const cols = row.split(sep);
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsv(rows: StructureRow[]): string {
  const header = ["ordem", "codigo", "descricao", "codigoSuperior", "nivel", "isTotal", "grupo"];
  const lines = rows.map((row) =>
    [
      row.ordem,
      row.codigo,
      row.descricao,
      row.codigoSuperior ?? "",
      row.nivel ?? "",
      row.isTotal,
      row.grupo ?? "",
    ]
      .map(csvEscape)
      .join(";")
  );

  return [header.join(";"), ...lines].join("\n");
}

function mapRows(rows: Record<string, any>[]): StructureRow[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);

  const kCodigo = findKey(keys, ["codigo", "código", "code", "conta", "cod", "conta_padrao"]);
  const kDescricao = findKey(keys, ["descricao", "descrição", "description", "nome", "name"]);
  const kSuperior = findKey(keys, ["codigoSuperior", "códigoSuperior", "contaSuperior", "pai", "parent", "parentCode", "parentcode", "codPai", "parent_code"]);
  const kNivel = findKey(keys, ["nivelVisualizacao", "nivel_visualizacao", "nivel", "nível", "level", "depth"]);
  const kOrdem = findKey(keys, ["ordem", "order", "sequencia", "sequência", "seq", "posicao", "posição"]);
  const kTotal = findKey(keys, ["isTotal", "is_total", "total", "subtotal", "ehTotal"]);
  const kGrupo = findKey(keys, ["grupo", "group", "categoria", "category"]);

  if (!kCodigo || !kDescricao) {
    throw new Error("Arquivo inválido: precisa ter pelo menos colunas 'codigo' (ou 'code') e 'descricao' (ou 'description').");
  }

  const parsed: StructureRow[] = [];
  const seenCodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const codigo = String(r[kCodigo] ?? "").trim();
    const descricao = String(r[kDescricao] ?? "").trim();
    if (!codigo || !descricao) continue;

    if (seenCodes.has(codigo)) {
      throw new Error(`Código duplicado na linha ${i + 2}: "${codigo}"`);
    }
    seenCodes.add(codigo);

    const codigoSuperior = kSuperior ? (String(r[kSuperior] ?? "").trim() || null) : null;
    const nivel = kNivel ? (parseNumber(r[kNivel]) ?? null) : null;
    const ordem = kOrdem ? (parseNumber(r[kOrdem]) ?? i + 1) : i + 1;
    const isTotal = kTotal ? parseBoolean(r[kTotal]) : false;
    const grupo = kGrupo ? (String(r[kGrupo] ?? "").trim() || null) : null;

    parsed.push({ ordem, codigo, descricao, codigoSuperior, nivel, isTotal, grupo });
  }

  parsed.sort((a, b) => a.ordem - b.ordem);
  return parsed;
}

// ─── GET /api/admin/standard-files ──────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "").toUpperCase();

    const shouldDownload = ["1", "true", "yes"].includes(
      (searchParams.get("download") || "").toLowerCase()
    );
    const format = (searchParams.get("format") || "csv").toLowerCase();

    if (!type) {
      const all = await prisma.standardStructure.findMany({
        orderBy: { type: "asc" },
        select: { type: true, version: true, updatedAt: true },
      });
      return NextResponse.json({ structures: all });
    }

    if (!ALLOWED_TYPES.includes(type as AllowedType)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const record = await prisma.standardStructure.findUnique({
      where: { type: type as any },
    });

    if (!record) {
      if (shouldDownload) {
        return NextResponse.json({ error: "Estrutura não encontrada" }, { status: 404 });
      }
      return NextResponse.json({ type, version: 0, rows: [], meta: null });
    }

    const data = record.data as any;
    const rows: StructureRow[] = Array.isArray(data?.rows) ? data.rows : [];

    if (shouldDownload) {
      if (format !== "csv" && format !== "json") {
        return NextResponse.json({ error: "Formato inválido. Use csv ou json." }, { status: 400 });
      }

      if (format === "json") {
        const payload = {
          type: record.type,
          version: record.version,
          rows,
          meta: data?.meta ?? null,
          updatedAt: record.updatedAt,
        };

        return new NextResponse(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename=\"estrutura_${record.type.toLowerCase()}_v${record.version}.json\"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const csv = rowsToCsv(rows);
      return new NextResponse(`\uFEFF${csv}`, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"estrutura_${record.type.toLowerCase()}_v${record.version}.csv\"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      type: record.type,
      version: record.version,
      rows,
      meta: data?.meta ?? null,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
    console.error("GET standard-files error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/standard-files ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let type: string;
    let rows: StructureRow[];
    let fileName: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      type = (form.get("type") || "").toString().trim().toUpperCase();
      const file = form.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
      }

      fileName = file.name || "estrutura";
      const isXlsx = fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls");
      const isCsv = fileName.toLowerCase().endsWith(".csv");

      if (!isXlsx && !isCsv) {
        return NextResponse.json({ error: "Formato inválido. Envie XLSX ou CSV." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      let rawRows: Record<string, any>[];

      if (isXlsx) {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else {
        rawRows = parseCsv(buffer.toString("utf-8"));
      }

      rows = mapRows(rawRows);
    } else {
      const body = await req.json();
      type = (body.type || "").toString().trim().toUpperCase();
      fileName = body.meta?.originalFileName || "manual";

      if (body.data?.rows && Array.isArray(body.data.rows)) {
        rows = body.data.rows;
      } else if (body.rows && Array.isArray(body.rows)) {
        rows = body.rows;
      } else {
        return NextResponse.json({ error: "data.rows é obrigatório" }, { status: 400 });
      }
    }

    if (!ALLOWED_TYPES.includes(type as AllowedType)) {
      return NextResponse.json({ error: `Tipo inválido: "${type}". Use: ${ALLOWED_TYPES.join(", ")}` }, { status: 400 });
    }

    if (!rows.length) {
      return NextResponse.json({ error: "Nenhuma linha válida encontrada. Verifique colunas: codigo e descricao." }, { status: 400 });
    }

    const existing = await prisma.standardStructure.findUnique({
      where: { type: type as any },
      select: { version: true, data: true },
    });

    const nextVersion = (existing?.version ?? 0) + 1;

    const previousRows: StructureRow[] = Array.isArray((existing as any)?.data?.rows)
      ? ((existing as any).data.rows as StructureRow[])
      : [];
    const existingAliases = (existing as any)?.data?.meta?.codeAliases || {};
    const codeAliases = buildCodeAliases(previousRows, rows, existingAliases);

    const saved = await prisma.standardStructure.upsert({
      where: { type: type as any },
      create: {
        type: type as any,
        version: 1,
        data: {
          rows,
          meta: {
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
            totalRows: rows.length,
            codeAliases,
          },
        },
      },
      update: {
        version: nextVersion,
        data: {
          rows,
          meta: {
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
            totalRows: rows.length,
            codeAliases,
          },
        },
      },
    });

    if (type === "BP" || type === "DRE") {
      invalidateEstruturaCache(type);
    }

    return NextResponse.json({
      ok: true,
      type: saved.type,
      version: saved.version,
      totalRows: rows.length,
      aliasesCount: Object.keys(codeAliases).length,
      updatedAt: saved.updatedAt,
    });
  } catch (err: any) {
    console.error("POST standard-files error:", err);
    return NextResponse.json({ error: err?.message || "Erro ao salvar estrutura" }, { status: 500 });
  }
}
