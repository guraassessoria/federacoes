import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

// Atualizar permissões de um usuário para empresas
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // Admin pode fazer tudo, Editor pode dar permissão de consulta
    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "EDITOR") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { companyId, role, action } = body;

    // Editor só pode dar permissão de CONSULTA
    if (currentUser.role === "EDITOR" && role !== "CONSULTA") {
      return NextResponse.json(
        { error: "Você só pode conceder permissão de consulta" },
        { status: 403 }
      );
    }

    if (action === "add") {
      await prisma.userCompany.upsert({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
        update: {
          role: role as UserRole,
        },
        create: {
          userId,
          companyId,
          role: role as UserRole,
        },
      });
    } else if (action === "remove") {
      await prisma.userCompany.delete({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating permissions:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar permissões" },
      { status: 500 }
    );
  }
}
