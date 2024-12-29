import { randomUUID } from "crypto";
import { uploadImageToS3AndGetPresignedUrl } from "./s3";

export const encodePossiblyLargePayload = async ({
  bucket: Bucket,
  key: incomingKey,
  length: incomingLength,
  payload,
}: {
  bucket: string;
  key?: string;
  length?: number;
  payload: any;
}) => {
  const key = incomingKey || randomUUID();
  let length = incomingLength || 0;
  if (!incomingLength) {
    // get size of payload in bytes
    length = new TextEncoder().encode(JSON.stringify(payload)).length;
  }
  // if length greater than 5MB, store in S3
  if (length > 5 * 1024 * 1024) {
    try {
      const presignedUrl = await uploadImageToS3AndGetPresignedUrl({ bucket: Bucket, key, buffer: Buffer.from(JSON.stringify(payload)) });
      return { presignedUrl };
    } catch (e) {
      console.error(e);
    }
  }
  return { ...payload };
};