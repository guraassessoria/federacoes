import { del, head } from "@vercel/blob";

function getBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing env var: BLOB_READ_WRITE_TOKEN");
  }
  return token;
}

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloudStoragePath: string }> {
  throw new Error("generatePresignedUploadUrl is deprecated. Use storage providers instead.");
}

export async function getFileUrl(
  cloudStoragePath: string,
  isPublic: boolean = false
): Promise<string> {
  const meta = await head(cloudStoragePath, { token: getBlobToken() });
  return isPublic ? meta.url : meta.downloadUrl;
}

export async function deleteFile(cloudStoragePath: string): Promise<void> {
  await del(cloudStoragePath, { token: getBlobToken() });
}
