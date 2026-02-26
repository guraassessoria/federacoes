import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["BP", "DRE", "DFC", "DMPL"] as const;

export async function GET(req: NextRequest, ctx: { params: { type: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const type = (ctx.params.type || "").toUpperCase();
    if (!ALLOWED.includes(type as any)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const structure = await prisma.standardStructure.findFirst({
      where: { type: type as any, isActive: true },
      orderBy: { version: "desc" },
      include: {
        lines: {
          orderBy: { order: "asc" },
          select: {
            order: true,
            code: true,
            description: true,
            group: true,
            parentCode: true,
            isTotal: true,
          },
        },
      },
    });

    if (!structure) {
      return NextResponse.json({ type, version: null, lines: [] });
    }

    return NextResponse.json({
      type,
      version: structure.version,
      lines: structure.lines,
    });
  } catch (err) {
    console.error("structures get error:", err);
    return NextResponse.json({ error: "Erro ao buscar estrutura" }, { status: 500 });
  }
}