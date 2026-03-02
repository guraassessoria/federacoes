// AWS configuration helpers are deprecated.
// Storage is now handled via Vercel Blob provider.  
// If this file is accidentally imported, throw to alert the caller.

export function getBucketConfig() {
  throw new Error("AWS bucket config is deprecated; use Vercel Blob storage instead.");
}

export function createS3Client() {
  throw new Error("AWS S3 client deprecated; use Vercel Blob storage instead.");
}
