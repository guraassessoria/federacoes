// app/api/upload/presigned/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFolder(input: string) {
  return input.replace(/[^a-zA-Z0-9/_-]/g, "") || "uploads";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Se quiser travar só ADMIN, mantém assim:
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Lê FormData (arquivo real)
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required (FormData)" }, { status: 400 });
    }

    const folderRaw = String(formData.get("folder") || "uploads");
    const companyId = String(formData.get("companyId") || "");

    const safeFolder = sanitizeFolder(folderRaw);
    const safeCompany = companyId ? sanitizeFolder(companyId) : "";
    const keyPrefix = safeCompany ? `${safeFolder}/${safeCompany}` : safeFolder;

    const key = `${keyPrefix}/${Date.now()}-${file.name}`;

    // 🔐 Token do Blob Store (o seu é BLOB_READ_WRITE_TOKEN)
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Missing env var: BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const blob = await put(key, arrayBuffer, {
      access: "private",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: false,
      token, // 👈 usa o seu token customizado
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      key,
      cloudStoragePath: blob.pathname, // padrão que você já usa no DB
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    });
  } catch (err: any) {
    console.error("Blob upload error:", err);
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
  }
}