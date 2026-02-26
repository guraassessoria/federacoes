import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const s3Client = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloudStoragePath: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  const cloudStoragePath = isPublic
    ? `${folderPrefix}public/uploads/${timestamp}-${safeName}`
    : `${folderPrefix}uploads/${timestamp}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { uploadUrl, cloudStoragePath };
}

export async function getFileUrl(
  cloudStoragePath: string,
  isPublic: boolean = false
): Promise<string> {
  const { bucketName } = getBucketConfig();
  const region = process.env.AWS_REGION || "us-east-1";

  if (isPublic) {
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloudStoragePath}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ResponseContentDisposition: "attachment",
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(cloudStoragePath: string): Promise<void> {
  const { bucketName } = getBucketConfig();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
  });

  await s3Client.send(command);
}
