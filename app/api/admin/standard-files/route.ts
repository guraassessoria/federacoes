import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FileType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { type, name, cloudStoragePath } = body;

    const file = await prisma.standardFile.upsert({
      where: { type: type as FileType },
      update: {
        name,
        cloudStoragePath,
        version: { increment: 1 },
      },
      create: {
        type: type as FileType,
        name,
        cloudStoragePath,
      },
    });

    return NextResponse.json({ file });
  } catch (error) {
    console.error("Error saving standard file:", error);
    return NextResponse.json(
      { error: "Erro ao salvar arquivo" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const files = await prisma.standardFile.findMany();

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching standard files:", error);
    return NextResponse.json(
      { error: "Erro ao buscar arquivos" },
      { status: 500 }
    );
  }
}
