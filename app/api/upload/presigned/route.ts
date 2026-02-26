import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleUpload } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);

    // Trava de governança (ajuste conforme sua política)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Retorne o Response gerado pelo handleUpload (isso resolve o erro do build)
    return await handleUpload({
      request,

      // Aqui você pode impor regras antes de gerar o token
      onBeforeGenerateToken: async (pathname) => {
        // Opcional: restringir quem pode subir arquivo (ex: ADMIN/EDITOR)
        const role = (session.user as any)?.role;
        if (!["ADMIN", "EDITOR"].includes(role)) {
          throw new Error("Sem permissão para upload");
        }

        // Opcional: validar path/pastas permitidas
        // Ex.: só permitir uploads/...
        // if (!pathname.startsWith("uploads/")) throw new Error("Path inválido");

        return {
          access: "private",
          // whitelist dos content-types aceitos
          allowedContentTypes: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
            "application/pdf",
          ],
          // payload opcional (vai para onUploadCompleted)
          tokenPayload: JSON.stringify({
            userId: (session.user as any)?.id,
            role,
          }),
        };
      },

      // Callback pós-upload (server-side)
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Aqui você pode auditar/logar, ou até gravar no banco se quiser
        // blob: { url, pathname, contentType, contentDisposition, ... }
        // tokenPayload: string (o JSON acima)
        console.log("Upload completed:", {
          pathname: blob.pathname,
          url: blob.url,
          tokenPayload,
        });

        return {
          response: "ok",
        };
      },
    });
  } catch (err: any) {
    console.error("Error in blob upload handler:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create upload token" },
      { status: 500 }
    );
  }
}