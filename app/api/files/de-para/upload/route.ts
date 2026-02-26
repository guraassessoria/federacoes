import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  "Conta Federação"?: any;
  "Conta Federacao"?: any;
  "Conta Federação "?: any;
  "Descrição Conta"?: any;
  "Descricao Conta"?: any;
  "Descrição Conta Federação"?: any;
  "Descricao Conta Federacao"?: any;
  "Padrão_BP"?: any;
  "Padrao_BP"?: any;
  "Padrão_DRE"?: any;
  "Padrao_DRE"?: any;
  "Padrão_DFC"?: any;
  "Padrao_DFC"?: any;
  "Padrão_DMPL"?: any;
  "Padrao_DMPL"?: any;
};

function normString(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const form = await req.formData();
    const companyId = String(form.get("companyId") || "");
    const file = form.get("file") as File | null;

    if (!companyId) {
      return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
    }

    // Permissão (ADMIN/EDITOR na empresa ou ADMIN global)
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId,
        role: { in: ["ADMIN", "EDITOR"] },
      },
    });
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!userCompany && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Lê arquivo
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });

    if (!rows.length) {
      return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });
    }

    // Mapeia colunas aceitando variações
    const mapped = rows
      .map((r) => {
        const conta =
          normString(r["Conta Federação"]) ||
          normString(r["Conta Federacao"]) ||
          normString(r["Conta Federação "]);

        const desc =
          normString(r["Descrição Conta Federação"]) ||
          normString(r["Descricao Conta Federacao"]) ||
          normString(r["Descrição Conta"]) ||
          normString(r["Descricao Conta"]);

        const padraoBP = normString(r["Padrão_BP"] ?? r["Padrao_BP"]);
        const padraoDRE = normString(r["Padrão_DRE"] ?? r["Padrao_DRE"]);
        const padraoDFC = normString(r["Padrão_DFC"] ?? r["Padrao_DFC"]);
        const padraoDMPL = normString(r["Padrão_DMPL"] ?? r["Padrao_DMPL"]);

        return {
          contaFederacao: conta,
          descricaoFederacao: desc || null,
          padraoBP: padraoBP || null,
          padraoDRE: padraoDRE || null,
          padraoDFC: padraoDFC || null,
          padraoDMPL: padraoDMPL || null,
        };
      })
      .filter((r) => r.contaFederacao);

    if (!mapped.length) {
      return NextResponse.json({ error: "Nenhuma linha válida encontrada (Conta Federação vazia)." }, { status: 400 });
    }

    // Validação: cada conta deve mapear pelo menos 1 padrão
    const invalid = mapped.find((r) => !r.padraoBP && !r.padraoDRE && !r.padraoDFC && !r.padraoDMPL);
    if (invalid) {
      return NextResponse.json(
        {
          error: `Conta ${invalid.contaFederacao} sem mapeamento. Preencha ao menos uma de: Padrão_BP, Padrão_DRE, Padrão_DFC, Padrão_DMPL.`,
        },
        { status: 400 }
      );
    }

    // Estratégia corporativa: "replace-all" por empresa (simples, determinístico)
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.deParaMapping.deleteMany({ where: { companyId } });
      const created = await tx.deParaMapping.createMany({
        data: mapped.map((m) => ({ companyId, ...m })),
      });
      return { deleted: deleted.count, inserted: created.count };
    });

    return NextResponse.json({
      ok: true,
      message: "De x Para salvo no banco com sucesso.",
      ...result,
    });
  } catch (err: any) {
    console.error("DE_PARA upload error:", err);
    return NextResponse.json({ error: "Erro ao processar De x Para" }, { status: 500 });
  }
}