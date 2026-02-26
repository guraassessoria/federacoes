import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, cloudStoragePath, fileName } = body;

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

    // Verificar se já existe um arquivo De x Para para esta empresa
    const existingFile = await prisma.companyFile.findFirst({
      where: {
        companyId,
        type: "DE_PARA",
      },
    });

    if (existingFile) {
      // Atualizar arquivo existente (sobrescrever)
      const updatedFile = await prisma.companyFile.update({
        where: { id: existingFile.id },
        data: {
          name: fileName,
          cloudStoragePath,
          uploadedById: session.user.id,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ 
        file: updatedFile, 
        message: "Arquivo De x Para sobrescrito com sucesso",
        overwritten: true 
      });
    }

    // Criar novo arquivo
    const file = await prisma.companyFile.create({
      data: {
        companyId,
        type: "DE_PARA",
        name: fileName,
        cloudStoragePath,
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
        type: "DE_PARA",
      },
      orderBy: { updatedAt: "desc" },
      include: {
        uploadedBy: {
          select: { name: true, email: true },
        },
      },
    });

    // Também retorna 'file' para compatibilidade com código existente
    return NextResponse.json({ files, file: files[0] || null });
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Erro ao buscar arquivo" },
      { status: 500 }
    );
  }
}
