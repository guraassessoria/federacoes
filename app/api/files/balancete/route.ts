import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MESES_ORDER = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function periodToNumber(period: string): number {
  // Converte "MMM/AA" para número comparável (AAMM)
  const [mes, ano] = period.split("/");
  const mesIdx = MESES_ORDER.indexOf(mes.toUpperCase());
  return parseInt(ano) * 100 + mesIdx;
}

function isPeriodInRange(period: string, startPeriod: string, endPeriod: string): boolean {
  const p = periodToNumber(period);
  const start = periodToNumber(startPeriod);
  const end = periodToNumber(endPeriod);
  return p >= start && p <= end;
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, startPeriod, endPeriod } = body;

    if (!companyId || !startPeriod || !endPeriod) {
      return NextResponse.json(
        { error: "companyId, startPeriod e endPeriod são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar permissão do usuário na empresa
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId,
        role: { in: ["ADMIN", "EDITOR"] },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!userCompany && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar todos os arquivos de balancete da empresa
    const files = await prisma.companyFile.findMany({
      where: {
        companyId,
        type: "BALANCETE",
        period: { not: null },
      },
    });

    // Filtrar arquivos que estão no range
    const filesToDelete = files.filter(
      (f) => f.period && isPeriodInRange(f.period, startPeriod, endPeriod)
    );

    // Coletar os períodos a serem deletados
    const periodsToDelete = filesToDelete.map((f) => f.period).filter(Boolean) as string[];

    // Deletar dados do balancete
    const deletedData = await prisma.balanceteData.deleteMany({
      where: {
        companyId,
        period: { in: periodsToDelete },
      },
    });

    // Deletar arquivos de balancete
    const deletedFiles = await prisma.companyFile.deleteMany({
      where: {
        id: { in: filesToDelete.map((f) => f.id) },
      },
    });

    return NextResponse.json({
      message: `${deletedFiles.count} arquivo(s) e ${deletedData.count} registro(s) deletados`,
      deletedFiles: deletedFiles.count,
      deletedRecords: deletedData.count,
      periods: periodsToDelete,
    });
  } catch (error) {
    console.error("Error deleting balancete:", error);
    return NextResponse.json(
      { error: "Erro ao deletar balancetes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, cloudStoragePath, fileName, period } = body;

    // Verificar permissão do usuário na empresa
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId,
        role: { in: ["ADMIN", "EDITOR"] },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!userCompany && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Se houver período, verificar se já existe um arquivo para esse período/empresa e sobrescrever
    if (period) {
      const existingFile = await prisma.companyFile.findFirst({
        where: {
          companyId,
          type: "BALANCETE",
          period,
        },
      });

      if (existingFile) {
        // Atualizar arquivo existente
        const updatedFile = await prisma.companyFile.update({
          where: { id: existingFile.id },
          data: {
            name: fileName,
            cloudStoragePath,
            uploadedById: session.user.id,
            updatedAt: new Date(),
          },
        });

        // Deletar dados antigos do balancete para esse período
        await prisma.balanceteData.deleteMany({
          where: {
            companyId,
            period,
          },
        });

        return NextResponse.json({ 
          file: updatedFile, 
          message: `Arquivo do período ${period} sobrescrito com sucesso`,
          overwritten: true 
        });
      }
    }

    // Criar novo arquivo
    const file = await prisma.companyFile.create({
      data: {
        companyId,
        type: "BALANCETE",
        name: fileName,
        cloudStoragePath,
        period: period || null,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json({ file, overwritten: false });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: "Erro ao salvar arquivo" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
    }

    const files = await prisma.companyFile.findMany({
      where: {
        companyId,
        type: "BALANCETE",
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Erro ao buscar arquivos" },
      { status: 500 }
    );
  }
}
