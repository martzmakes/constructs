import { Tracer } from '@aws-lambda-powertools/tracer';
import {
  EventBridgeClient,
} from "@aws-sdk/client-eventbridge";
import { getTracer } from './tracer';

let cachedEventBridgeClient: EventBridgeClient;
export function getEbClient(tracer?: Tracer) {
  if (!cachedEventBridgeClient) {
    const myTracer = tracer ?? getTracer();

    cachedEventBridgeClient = myTracer
      ? myTracer.captureAWSv3Client(new EventBridgeClient({}))
      : new EventBridgeClient({});
  }

  return cachedEventBridgeClient;
};
