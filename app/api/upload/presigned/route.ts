import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { handleUpload } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  // Upload só para ADMIN
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // O handleUpload espera um JSON específico enviado pelo client
  const body = await request.json();

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // Você pode impor regras de nomenclatura/pastas aqui
        // Ex: bloquear extensões perigosas etc.
        return {
          allowedContentTypes: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
            "application/pdf",
            "application/octet-stream",
          ],
          tokenPayload: {
            // Opcional: rastreabilidade
            userId: (session.user as any).id,
            role: (session.user as any).role,
          },
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Aqui você pode logar/auditar se quiser
        console.log("Upload completed:", blob.pathname, tokenPayload);
      },
    });

    return response;
  } catch (error: any) {
    console.error("Error handling blob upload:", error);
    return NextResponse.json({ error: "Upload authorization failed" }, { status: 500 });
  }
}
