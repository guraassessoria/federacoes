import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  "Período"?: any;
  "Periodo"?: any;
  "Número da Conta"?: any;
  "Numero da Conta"?: any;
  "Conta"?: any;
  "Descrição da Conta"?: any;
  "Descricao da Conta"?: any;
  "Saldo Anterior"?: any;
  "Débito"?: any;
  "Debito"?: any;
  "Crédito"?: any;
  "Credito"?: any;
  "Saldo Final"?: any;
  "Natureza da Conta"?: any;
  "Natureza"?: any;
};

function s(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toDecimal(v: any) {
  // aceita "1.234,56" ou "1234.56" ou number
  if (v === null || v === undefined || v === "") return new Prisma.Decimal(0);
  if (typeof v === "number") return new Prisma.Decimal(v.toFixed(2));
  const raw = String(v).trim();
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/\./g, "")       // remove milhar pt-BR
    .replace(/,/g, ".");      // vírgula -> ponto
  const n = Number(cleaned);
  if (Number.isNaN(n)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(n.toFixed(2));
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const form = await req.formData();
    const companyId = String(form.get("companyId") || "");
    const period = String(form.get("period") || ""); // ex: "JAN/25"
    const file = form.get("file") as File | null;

    if (!companyId) return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
    if (!period) return NextResponse.json({ error: "period é obrigatório (ex: JAN/25)" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });

    // Permissão
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

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });

    if (!rows.length) {
      return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });
    }

    const mapped = rows
      .map((r) => {
        const accountNumber = s(r["Número da Conta"] ?? r["Numero da Conta"] ?? r["Conta"]);
        const accountDescription = s(r["Descrição da Conta"] ?? r["Descricao da Conta"]);
        const previousBalance = toDecimal(r["Saldo Anterior"]);
        const debit = toDecimal(r["Débito"] ?? r["Debito"]);
        const credit = toDecimal(r["Crédito"] ?? r["Credito"]);
        const finalBalance = toDecimal(r["Saldo Final"]);
        const accountNature = s(r["Natureza da Conta"] ?? r["Natureza"]).toUpperCase();

        return {
          companyId,
          period,
          accountNumber,
          accountDescription: accountDescription || "",
          previousBalance,
          debit,
          credit,
          finalBalance,
          accountNature: accountNature === "C" || accountNature === "D" ? accountNature : "D",
        };
      })
      .filter((r) => r.accountNumber);

    if (!mapped.length) {
      return NextResponse.json({ error: "Nenhuma linha válida (Número da Conta vazio)." }, { status: 400 });
    }

    // Estratégia: substituir o período inteiro (governança e rastreabilidade)
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.balanceteData.deleteMany({
        where: { companyId, period },
      });
      const created = await tx.balanceteData.createMany({
        data: mapped,
      });
      return { deleted: deleted.count, inserted: created.count };
    });

    return NextResponse.json({
      ok: true,
      message: `Balancete ${period} salvo no banco com sucesso.`,
      ...result,
    });
  } catch (err: any) {
    console.error("BALANCETE upload error:", err);
    return NextResponse.json({ error: "Erro ao processar balancete" }, { status: 500 });
  }
}
