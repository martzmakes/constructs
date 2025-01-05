import { Tracer } from "@aws-lambda-powertools/tracer";
import { APIGatewayEvent, Context } from "aws-lambda";
import { EventDetailTypes } from "../../shared/event-detail-types";
import { getTracer } from "../clients/tracer";
import { putEvent } from "../helpers/eb";
import { verifyDiscordRequest } from "../discord/verifyDiscordRequest";
import { ApiErrorResponse } from "../interfaces/ApiErrorResponse";

export type DiscordInteractionHandler<TInput, TOutput> = (args: {
  body: TInput;
  name?: string;
  logStreamUrl: string;
}) => Promise<{
  data: TOutput | ApiErrorResponse;
  statusCode?: number; // default to 200
}>;
export const initDiscordInteractionHandler = <TInput, TOutput>({
  defaultInteractionHandler,
  slashHandler,
  buttonHandler,
  disableEventTracking,
  errorOutput,
  tracer = getTracer(),
}: {
  defaultInteractionHandler: DiscordInteractionHandler<TInput, TOutput>;
  slashHandler?: DiscordInteractionHandler<TInput, TOutput>;
  buttonHandler?: DiscordInteractionHandler<TInput, TOutput>;
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
      const headers = (event.headers || {}) as Record<string, string>;
      try {
        if (!disableEventTracking && headers.source) {
          await putEvent({
            data: JSON.stringify({
              source: `discord-${body.type === 1 ? "verify" : "interaction-"}${
                body.type === 1 ? "" : body.data.name
              }`,
              target: process.env.AWS_LAMBDA_FUNCTION_NAME!,
              queue: false,
              internalApi: false,
            }),
            type: EventDetailTypes.Arch,
          });
        }
      } catch (e) {
        console.warn(e);
      }
      switch (body.type) {
        case 1:
          handlerOutput = await verifyDiscordRequest({ body, headers });
          break;
        case 2:
          if (slashHandler) {
            const name = body.data.name;
            handlerOutput = await slashHandler({
              body: body as TInput,
              name,
              logStreamUrl,
            });
            if (handlerOutput) {
              break;
            }
          }
        case 3:
          if (buttonHandler) {
            const name = body.data.custom_id;
            handlerOutput = await buttonHandler({
              body: body as TInput,
              name,
              logStreamUrl,
            });
            if (handlerOutput) {
              break;
            }
          }
        default:
          handlerOutput = await defaultInteractionHandler({
            body: body as TInput,
            logStreamUrl,
          });
          break;
      }
      tracer.addResponseAsMetadata(handlerOutput, process.env._HANDLER);
    } catch (err) {
      console.error(err);
      tracer.addErrorAsMetadata(err as Error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: (err as Error).message,
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
      statusCode: handlerOutput.statusCode || 200,
    };
  };
};
