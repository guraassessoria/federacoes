import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/standard-files?type=BP|DRE|DFC|DMPL
 * Retorna a estrutura padrão salva no banco.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const record = await prisma.standardStructure.findUnique({
      where: { type: type as any },
    });

    return NextResponse.json({
      type,
      version: record?.version ?? 0,
      data: record?.data ?? null,
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (err) {
    console.error("GET standard-files error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/standard-files
 * Body: { type: "BP"|"DRE"|"DFC"|"DMPL", data: any }
 * Salva a estrutura padrão no banco (sobrescreve e incrementa versão).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, data } = body as { type?: string; data?: any };

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "data is required" }, { status: 400 });
    }

    const existing = await prisma.standardStructure.findUnique({
      where: { type: type as any },
    });

    const saved = await prisma.standardStructure.upsert({
      where: { type: type as any },
      create: {
        type: type as any,
        data,
        version: 1,
      },
      update: {
        data,
        version: (existing?.version ?? 0) + 1,
      },
    });

    return NextResponse.json({
      ok: true,
      type: saved.type,
      version: saved.version,
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    console.error("POST standard-files error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}