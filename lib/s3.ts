// AWS S3 helper is deprecated. Application now uses Vercel Blob storage.
// Keep this file present to avoid breaking imports but throw errors if used.

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
  throw new Error("getFileUrl is deprecated. Use storage providers instead.");
}

export async function deleteFile(cloudStoragePath: string): Promise<void> {
  throw new Error("deleteFile is deprecated. Use storage providers instead.");
}
