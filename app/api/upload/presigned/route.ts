import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { handleUpload } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    return await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        tokenPayload: {
          userId: (session.user as any).id,
          role: (session.user as any).role,
        },
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log("Upload completed:", blob.pathname);
      },
    });
  } catch (err) {
    console.error("Blob upload auth failed:", err);
    return NextResponse.json({ error: "Upload authorization failed" }, { status: 500 });
  }
}
