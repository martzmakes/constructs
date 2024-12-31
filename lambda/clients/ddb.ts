import { Tracer } from "@aws-lambda-powertools/tracer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getTracer } from "./tracer";

const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: false, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: true, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: true, // false, by default.
};

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false, // false, by default.
};

const translateConfig = {
  marshallOptions,
  unmarshallOptions,
};

let cachedDynamoClient: DynamoDBDocumentClient;
export function getDynamoClient(tracer?: Tracer) {
  if (!cachedDynamoClient) {
    const myTracer = tracer ?? getTracer();
    const client = myTracer
      ? myTracer.captureAWSv3Client(new DynamoDBClient({}))
      : new DynamoDBClient({});
    cachedDynamoClient = DynamoDBDocumentClient.from(client, translateConfig);
  }

  return cachedDynamoClient;
}
