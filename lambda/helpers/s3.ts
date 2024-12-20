import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../clients/s3";

const s3 = getS3Client();

export const uploadImageToS3AndGetPresignedUrl = async ({
  key,
  buffer,
  bucket = process.env.BUCKET_NAME,
}: {
  key: string;
  buffer: Buffer;
  bucket?: string;
}): Promise<string> => {
  try {
    // Upload the buffer to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: "image/png", // Adjust the content type based on your image format
      })
    );

    // Generate a presigned URL
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 3600 } // Presigned URL expiration time in seconds (e.g., 1 hour)
    );

    return url;
  } catch (error) {
    console.error("Error uploading to S3 or generating presigned URL:", error);
    throw error;
  }
};
