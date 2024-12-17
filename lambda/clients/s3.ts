import { S3Client } from "@aws-sdk/client-s3";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { getTracer } from "./tracer";

let cachedS3Client: S3Client;
export const getS3Client = (tracer?: Tracer) => {
  if (!cachedS3Client) {
    const myTracer = tracer ?? getTracer();

    cachedS3Client = myTracer
      ? myTracer.captureAWSv3Client(new S3Client({}))
      : new S3Client({});
  }

  return cachedS3Client;
};
