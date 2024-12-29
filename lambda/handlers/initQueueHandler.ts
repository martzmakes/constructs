import { Tracer } from "@aws-lambda-powertools/tracer";
import {
  SQSEvent,
  Context,
  SQSBatchResponse,
  EventBridgeEvent,
} from "aws-lambda";
import { EventDetailTypes } from "../../shared/event-detail-types";
import { getTracer } from "../clients/tracer";
import { prepareEventPayload, putEvents } from "../helpers/eb";
import { PreparedEventPayload } from "../interfaces/PreparedEventPayload";
import { decodePossiblyLargePayload } from "../helpers/decodePayload";

/*
Usage:
export interface DummyData {
  message: string;
}
const main: QueueHandler<DummyData> = async ({ records }) => {
  for (const record of records) {
    const { message } = record; // already parsed!
    ... your normal processing here
  }
}

export const handler = initQueueHandler({
  queueHandler: main,
});
*/

export type QueueHandler<TInput> = (args: {
  event: any; // escape hatch
  records: TInput[];
  logStreamUrl: string;
}) => Promise<SQSBatchResponse | void>;
export const initQueueHandler = <TInput>({
  disableEventTracking,
  queueHandler,
  tracer = getTracer(),
}: {
  disableEventTracking?: boolean;
  queueHandler: QueueHandler<TInput>;
  tracer?: Tracer;
}) => {
  return async (event: SQSEvent, context: Context) => {
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
      const records: TInput[] = [];
      const incomingEvents: Record<
        string,
        {
          account: string;
          source: string;
          detailType: string;
          sourceFn: string;
        }
      > = {};
      for (const record of event.Records) {
        try {
          const recordEvent = JSON.parse(record.body) as EventBridgeEvent<
            string,
            PreparedEventPayload<TInput>
          >;
          if (recordEvent?.detail?.meta?.fn) {
            const account = recordEvent.account;
            const source = recordEvent.detail?.meta?.outgoing?.source;
            const detailType = `${recordEvent.detail?.meta?.outgoing?.detailType}`;
            const sourceFn = recordEvent.detail.meta.fn;
            const composite = `${account}:${source}:${detailType}:${sourceFn}`;
            incomingEvents[composite] = {
              account,
              source,
              detailType,
              sourceFn,
            };
          }
          if (recordEvent.detail) {
            // eventbridge queue
            const { data } = recordEvent.detail;
            const decodedData = await decodePossiblyLargePayload({ payload: data });
            records.push(decodedData as TInput);
          } else {
            // api queue
            records.push(JSON.parse(record.body) as TInput);
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!disableEventTracking) {
        const incomingEventNotifications: PreparedEventPayload<string>[] = [];
        for (const incomingEvent of Object.values(incomingEvents)) {
          incomingEventNotifications.push(
            prepareEventPayload({
              data: JSON.stringify({
                ...incomingEvent,
                targetFn: process.env.AWS_LAMBDA_FUNCTION_NAME!,
                queue: true,
              }),
              type: EventDetailTypes.Arch,
            })
          );
        }
        try {
          await putEvents({
            payloads: incomingEventNotifications,
          });
        } catch (e) {
          console.warn(e);
        }
      }
      handlerOutput = await queueHandler({
        event,
        records: records as TInput[],
        logStreamUrl,
      });
      if (handlerOutput?.batchItemFailures) {
        console.error("Batch item failures", handlerOutput.batchItemFailures);
      }
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
    return handlerOutput;
  };
};
