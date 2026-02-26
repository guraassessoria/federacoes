import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["BP", "DRE", "DFC", "DMPL"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function normalizeHeader(h: string) {
  return (h || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseBoolean(v: any): boolean {
  if (typeof v === "boolean") return v;
  const s = (v ?? "").toString().trim().toLowerCase();
  return ["1", "true", "sim", "yes", "y"].includes(s);
}

function parseNumber(v: any, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = (v ?? "").toString().replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

type ParsedLine = {
  order: number;
  code: string;
  description: string;
  group?: string | null;
  parentCode?: string | null;
  isTotal: boolean;
};

function parseCsv(content: string): any[] {
  // CSV simples; você pode subir XLSX preferencialmente.
  // Espera separador ; ou , e headers na primeira linha.
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim());

  return lines.slice(1).map((row) => {
    const cols = row.split(sep);
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = cols[i]));
    return obj;
  });
}

function mapRowsToLines(rows: any[]): ParsedLine[] {
  // Esperado: order, code, description, group, parentCode, isTotal
  // Aceita variações de header: "ordem", "codigo", etc.
  const headerMap = (row: any) => {
    const keys = Object.keys(row);
    const pick = (candidates: string[]) => {
      const found = keys.find((k) => candidates.includes(normalizeHeader(k)));
      return found ? row[found] : undefined;
    };

    const order = parseNumber(
      pick(["order", "ordem", "sequencia", "seq", "posição", "posicao"]),
      0
    );

    const codeRaw = pick(["code", "codigo", "código", "conta", "cod"]);
    const descRaw = pick(["description", "descricao", "descrição", "nome"]);

    const groupRaw = pick(["group", "grupo"]);
    const parentRaw = pick(["parentcode", "pai", "parent", "codpai", "parent_code"]);
    const isTotalRaw = pick(["istotal", "total", "subtotal", "is_total"]);

    const code = (codeRaw ?? "").toString().trim();
    const description = (descRaw ?? "").toString().trim();
    const group = groupRaw !== undefined ? (groupRaw ?? "").toString().trim() : null;
    const parentCode = parentRaw !== undefined ? (parentRaw ?? "").toString().trim() : null;

    return {
      order: Number.isFinite(order) ? Math.trunc(order) : 0,
      code,
      description,
      group: group || null,
      parentCode: parentCode || null,
      isTotal: parseBoolean(isTotalRaw),
    };
  };

  const parsed = rows.map(headerMap);

  // valida mínimo
  const cleaned = parsed
    .filter((l) => l.code && l.description)
    .map((l, idx) => ({
      ...l,
      order: l.order > 0 ? l.order : idx + 1,
    }));

  // ordena
  cleaned.sort((a, b) => a.order - b.order);

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Somente ADMIN pode atualizar estrutura global
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const type = (form.get("type") || "").toString().trim().toUpperCase();
    const file = form.get("file") as File | null;

    if (!ALLOWED_TYPES.includes(type as AllowedType)) {
      return NextResponse.json({ error: "Tipo inválido. Use BP, DRE, DFC ou DMPL." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
    }

    const filename = file.name || "estrutura";
    const isXlsx = filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls");
    const isCsv = filename.toLowerCase().endsWith(".csv");

    if (!isXlsx && !isCsv) {
      return NextResponse.json({ error: "Formato inválido. Envie XLSX ou CSV." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: any[] = [];

    if (isXlsx) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    } else {
      const text = buffer.toString("utf-8");
      rows = parseCsv(text);
    }

    const lines = mapRowsToLines(rows);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "Não encontrei linhas válidas. Verifique colunas mínimas: code e description." },
        { status: 400 }
      );
    }

    // versionamento: desativa a atual e cria nova ativa com version+1
    const lastActive = await prisma.standardStructure.findFirst({
      where: { type: type as any, isActive: true },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });

    const nextVersion = (lastActive?.version ?? 0) + 1;

    const created = await prisma.$transaction(async (tx) => {
      // desativa todas ativas desse type (governança)
      await tx.standardStructure.updateMany({
        where: { type: type as any, isActive: true },
        data: { isActive: false },
      });

      const structure = await tx.standardStructure.create({
        data: {
          type: type as any,
          version: nextVersion,
          isActive: true,
          lines: {
            createMany: {
              data: lines.map((l) => ({
                order: l.order,
                code: l.code,
                description: l.description,
                group: l.group ?? null,
                parentCode: l.parentCode ?? null,
                isTotal: l.isTotal,
              })),
            },
          },
        },
        select: { id: true, type: true, version: true },
      });

      return structure;
    });

    return NextResponse.json({
      ok: true,
      type,
      version: created.version,
      totalLines: lines.length,
    });
  } catch (err: any) {
    console.error("structures upload error:", err);
    return NextResponse.json({ error: "Erro ao salvar estrutura" }, { status: 500 });
  }
}