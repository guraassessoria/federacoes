import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeHeader(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toDecimal(value: any) {
  if (!value) return new Prisma.Decimal(0);

  if (typeof value === "number") {
    return new Prisma.Decimal(value.toFixed(2));
  }

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const n = Number(cleaned);
  if (isNaN(n)) return new Prisma.Decimal(0);

  return new Prisma.Decimal(n.toFixed(2));
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
    const companyId = String(form.get("companyId") || "");
    const period = String(form.get("period") || "");
    const file = form.get("file") as File | null;

    if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
    if (!period) return NextResponse.json({ error: "period obrigatório" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

    if (!rawRows.length) {
      return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });
    }

    const rows = rawRows.map((row) => {
      const normalized: Record<string, any> = {};

      Object.keys(row).forEach((key) => {
        normalized[normalizeHeader(key)] = row[key];
      });

      const accountNumber =
        normalized["numero da conta"] ||
        normalized["numero"] ||
        normalized["conta"] ||
        normalized["codigo"] ||
        normalized["cod"] ||
        normalized["classificacao"];

      const accountDescription =
        normalized["descricao da conta"] ||
        normalized["descricao"] ||
        normalized["nome da conta"] ||
        normalized["conta descricao"];

      const previousBalance =
        normalized["saldo anterior"] ||
        normalized["saldo inicial"];

      const debit =
        normalized["debito"] ||
        normalized["deb"] ||
        normalized["mov debito"];

      const credit =
        normalized["credito"] ||
        normalized["cred"] ||
        normalized["mov credito"];

      const finalBalance =
        normalized["saldo final"] ||
        normalized["saldo"];

      const accountNature =
        normalized["natureza"] ||
        normalized["natureza da conta"] ||
        "D";

      return {
        accountNumber: String(accountNumber || "").trim(),
        accountDescription: String(accountDescription || "").trim(),
        previousBalance: toDecimal(previousBalance),
        debit: toDecimal(debit),
        credit: toDecimal(credit),
        finalBalance: toDecimal(finalBalance),
        accountNature: String(accountNature || "D").toUpperCase(),
      };
    });

    const validRows = rows.filter((r) => r.accountNumber);

    if (!validRows.length) {
      return NextResponse.json(
        { error: "Nenhuma linha válida (Número da Conta vazio)." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.balancete.deleteMany({
        where: { companyId, period },
      });

      const created = await tx.balancete.createMany({
        data: validRows.map((r) => ({
          companyId,
          period,
          accountCode: r.accountNumber,
          accountDescription: r.accountDescription,
          openingBalance: r.previousBalance,
          debit: r.debit,
          credit: r.credit,
          closingBalance: r.finalBalance,
          accountNature: r.accountNature === "C" ? "C" : "D",
        })),
      });

      return { deleted: deleted.count, inserted: created.count };
    });

    return NextResponse.json({
      ok: true,
      message: `Balancete ${period} salvo com sucesso.`,
      ...result,
    });

  } catch (err: any) {
    console.error("BALANCETE ERROR:", err);
    return NextResponse.json(
      { error: "Erro ao processar balancete." },
      { status: 500 }
    );
  }
}