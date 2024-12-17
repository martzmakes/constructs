import { Tracer } from "@aws-lambda-powertools/tracer";
import { EventBridgeEvent, Context } from "aws-lambda";
import { getTracer } from "../clients/tracer";
import { EventDetailTypes } from "../../shared/event-detail-types";
import { putEvents, prepareEventPayload } from "../helpers/eb";
import { PreparedEventPayload } from "../interfaces/PreparedEventPayload";

/*
Usage:
export interface DummyData {
  message: string;
}
const main: EventHandler<DummyData> = async ({ data }) => {
  const { message } = data; // already parsed body!
  ... your normal processing here
}

export const handler = initEventHandler({
  eventHandler: main,
});
*/

export type EventHandler<TInput> = (args: {
  data: TInput;
  event: any; // escape hatch
  logStreamUrl: string;
}) => Promise<void>;
export const initEventHandler = <TInput>({
  disableEventTracking,
  eventHandler,
  tracer = getTracer(),
}: {
  disableEventTracking?: boolean;
  eventHandler: EventHandler<TInput>;
  tracer?: Tracer;
}) => {
  return async (
    event: EventBridgeEvent<string, PreparedEventPayload<TInput>>,
    context: Context
  ) => {
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
      if (!disableEventTracking && event.detail?.meta?.fn) {
        await putEvents({
          payloads: [
            prepareEventPayload({
              data: JSON.stringify({
                account: event.account,
                detailType: event.detail?.meta?.outgoing?.detailType,
                source: event.detail?.meta?.outgoing?.source,
                sourceFn: event.detail.meta.fn,
                targetFn: process.env.AWS_LAMBDA_FUNCTION_NAME!,
                queue: false,
              }),
              type: EventDetailTypes.Arch,
              event,
            }),
          ],
        });
      }
    } catch (e) {
      console.warn(e);
    }
    try {
      const { data } = event.detail;
      handlerOutput = await eventHandler({
        data: data as TInput,
        event,
        logStreamUrl,
      });
      tracer.addResponseAsMetadata(handlerOutput, process.env._HANDLER);
    } catch (err) {
      tracer.addErrorAsMetadata(err as Error);
      throw err;
    } finally {
      if (segment && subsegment) {
        subsegment.close();
        tracer.setSegment(segment);
      }
    }
  };
};
