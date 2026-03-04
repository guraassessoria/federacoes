// app/api/import/de-para/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  // aceita ; ou ,
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => normalizeHeader(h));

  return lines.slice(1).map((line) => {
    const cols = line.split(sep);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = toStr(cols[i])));
    return obj;
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const form = await req.formData();
    const companyId = toStr(form.get("companyId"));
    const file = form.get("file");

    if (!companyId) {
      return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file é obrigatório" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    let rows: any[] = [];

    if (name.endsWith(".csv")) {
      const text = buf.toString("utf-8");
      rows = parseCsv(text);
    } else {
      // XLSX
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

      rows = json.map((r) => {
        const mapped: Record<string, string> = {};
        for (const k of Object.keys(r)) {
          mapped[normalizeHeader(k)] = toStr(r[k]);
        }
        return mapped;
      });
    }

    // headers aceitos (flexível):
    // conta federacao / conta_balancete
    // descricao
    // padrao_bp/dre/dfc/dmpl
    const payload = rows
      .map((r) => {
        const contaBalancete =
          r["contafederacao"] || r["contabalancete"] || r["conta"] || "";
        if (!contaBalancete) return null;

        return {
          companyId,
          contaBalancete: toStr(contaBalancete),
          descricaoBalancete: toStr(r["descricaocontafederacao"] || r["descricao"] || r["descricaoconta"] || ""),
          padraoBP: toStr(r["padraobp"] || r["bp"] || ""),
          padraoDRE: toStr(r["padraodre"] || r["dre"] || ""),
          padraoDFC: toStr(r["padraodfc"] || r["dfc"] || ""),
          padraoDMPL: toStr(r["padraodmpl"] || r["dmpl"] || ""),
        };
      })
      .filter(Boolean) as any[];

    if (!payload.length) {
      return NextResponse.json({ error: "Nenhuma linha válida encontrada" }, { status: 400 });
    }

    // Upsert por (companyId, contaBalancete)
    const ops = payload.map((p) =>
      prisma.deParaRow.upsert({
        where: {
          companyId_contaBalancete: {
            companyId: p.companyId,
            contaBalancete: p.contaBalancete,
          },
        },
        update: {
          descricaoBalancete: p.descricaoBalancete,
          padraoBP: p.padraoBP,
          padraoDRE: p.padraoDRE,
          padraoDFC: p.padraoDFC,
          padraoDMPL: p.padraoDMPL,
        },
        create: p,
      })
    );

    await prisma.$transaction(ops);

    return NextResponse.json({
      ok: true,
      companyId,
      imported: payload.length,
    });
  } catch (e: any) {
    console.error("Import DE-PARA error:", e);
    return NextResponse.json({ error: "Erro ao importar DE-PARA" }, { status: 500 });
  }
}