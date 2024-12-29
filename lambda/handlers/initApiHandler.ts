import { Tracer } from "@aws-lambda-powertools/tracer";
import { APIGatewayEvent, Context } from "aws-lambda";
import { EventDetailTypes } from "../../shared/event-detail-types";
import { getTracer } from "../clients/tracer";
import { decodePossiblyLargePayload } from "../helpers/decodePayload";
import { putEvents, prepareEventPayload } from "../helpers/eb";

/*
Usage:
export interface DummyRequest {
  message: string;
}
export interface DummyResponse {
  response: string;
}
const main: ApiHandler<DummyRequest, DummyResponse> = async ({ body }) => {
  const { message } = body; // already parsed body!
  return {
    statusCode: 200,
    data: { response: "Response" },
  };
}

export const handler = initApiHandler({
  apiHandler: main,
});
*/

export interface ApiErrorResponse {
  message: string;  // message for error messages
}

export type ApiHandler<TInput, TOutput> = (args: {
  body: TInput;
  event: APIGatewayEvent; // escape hatch
  headers: Record<string, string>;
  method: string;
  path: string;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string>;
  logStreamUrl: string;
}) => Promise<{
  data: TOutput | ApiErrorResponse;
  headers?: Record<string, string>;
  statusCode?: number; // default to 200
}>;
export const initApiHandler = <TInput, TOutput>({
  apiHandler,
  disableEventTracking,
  errorOutput,
  tracer = getTracer(),
}: {
  apiHandler: ApiHandler<TInput, TOutput>;
  disableEventTracking?: boolean;
  errorOutput?: any;
  tracer?: Tracer;
}) => {
  return async (event: APIGatewayEvent, context: Context) => {
    console.log(JSON.stringify(event, null, 2));
    const segment = tracer.getSegment(); // This is the facade segment (the one that is created by AWS Lambda)
    let subsegment;
    if (segment) {
      // Create subsegment for the function & set it as active
      subsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
      tracer.setSegment(subsegment);
    }
    tracer.annotateColdStart();
    tracer.addServiceNameAnnotation();
    const logGroupName = context.logGroupName;
    const logStreamName = context.logStreamName;

    const region = process.env.AWS_REGION;

    const logStreamUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeURIComponent(
      logGroupName
    )}/log-events/${encodeURIComponent(logStreamName)}`;
    let handlerOutput;
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const decodedBody = await decodePossiblyLargePayload({ payload: body });
      const headers = (event.headers || {}) as Record<string, string>;
      try {
        if (!disableEventTracking && headers.sourceFn) {
          await putEvents({
            payloads: [
              prepareEventPayload({
                data: JSON.stringify({
                  sourceFn: headers.sourceFn,
                  targetFn: process.env.AWS_LAMBDA_FUNCTION_NAME!,
                  queue: false,
                  internalApi: true,
                }),
                type: EventDetailTypes.Arch,
              }),
            ],
          });
        }
      } catch (e) {
        console.warn(e);
      }
      handlerOutput = await apiHandler({
        event,
        body: decodedBody as TInput,
        headers,
        method: event.httpMethod,
        path: event.path,
        pathParameters: (event.pathParameters || {}) as Record<string, string>,
        queryStringParameters: (event.queryStringParameters || {}) as Record<
          string,
          string
        >,
        logStreamUrl,
      });
      tracer.addResponseAsMetadata(handlerOutput, process.env._HANDLER);
    } catch (err) {
      console.error(err);
      tracer.addErrorAsMetadata(err as Error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: (err as Error).message
        }),
      };
    } finally {
      if (segment && subsegment) {
        subsegment.close();
        tracer.setSegment(segment);
      }
    }

    if (!handlerOutput)
      return errorOutput || { statusCode: 500, body: "Unknown error" };

    return {
      body: JSON.stringify(handlerOutput.data),
      headers: handlerOutput.headers,
      statusCode: handlerOutput.statusCode || 200,
    }
  };
};
