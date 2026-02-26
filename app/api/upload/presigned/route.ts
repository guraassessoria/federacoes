import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Se você quer restringir upload só para ADMIN:
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filename, contentType, folder } = body as {
      filename: string;
      contentType?: string;
      folder?: string;
    };

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    // Caminho lógico no Blob (organização)
    const safeFolder = folder?.replace(/[^a-zA-Z0-9/_-]/g, "") || "uploads";
    const key = `${safeFolder}/${Date.now()}-${filename}`;

    // put() retorna uma URL definitiva no Blob.
    // Para "upload direto do client", use o modo `token` (client upload).
    // Como o seu front já pede "presigned", o jeito mais compatível é:
    const blob = await put(key, "", {
      access: "private",
      contentType: contentType || "application/octet-stream",
      addRandomSuffix: false,
    });

    // ⚠️ Esse put acima cria o objeto vazio.
    // Se seu front precisa de URL para enviar o arquivo via PUT, o ideal é usar `@vercel/blob/client`.
    // Vou te dar a versão correta no item 3 abaixo (recomendado).
    return NextResponse.json({ url: blob.url, pathname: blob.pathname, key });
  } catch (err: any) {
    console.error("Error generating blob upload URL:", err);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
