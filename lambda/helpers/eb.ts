import {
  PutEventsRequestEntry,
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { EventBridgeEvent } from "aws-lambda";
import { batchInvoke } from "./batchInvoke";
import { getEbClient } from "../clients/eb";
import { PreparedEventPayload } from "../interfaces/PreparedEventPayload";

export function prepareEventPayload<T>(args: {
  data: string;
  type: string;
  event?: EventBridgeEvent<string, any>;
}): PreparedEventPayload<T> {
  if (!process.env.EVENT_SOURCE)
    throw new Error("process.env.EVENT_SOURCE is not set");
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME)
    throw new Error("process.env.AWS_LAMBDA_FUNCTION_NAME is not set");

  const { data, type: detailType, event } = args;

  const payload: PreparedEventPayload<T> = {
    data: { ...JSON.parse(data) },
    meta: {
      ...(event
        ? {
            incoming: {
              account: event.account,
              source: event.source,
              detailType: event["detail-type"],
            },
          }
        : {}),
      outgoing: {
        source: process.env.EVENT_SOURCE,
        detailType,
      },
      fn: process.env.AWS_LAMBDA_FUNCTION_NAME,
    },
  };

  return payload;
}

function preparePutEventsRequestEntry<T>(payload: PreparedEventPayload<T>) {
  if (!process.env.EVENT_SOURCE)
    throw new Error("process.env.EVENT_SOURCE is not set");
  const detailType = payload?.meta?.outgoing?.detailType;
  if (!detailType)
    throw new Error(
      `payload is missing detailType (in meta.outgoing): ${JSON.stringify({
        payload,
      })}`
    );
  const entry: PutEventsRequestEntry = {
    Detail: JSON.stringify(payload),
    DetailType: detailType as string,
    EventBusName: "default",
    Source: process.env.EVENT_SOURCE,
  };
  return entry;
}

export async function putEvent<T>(args: {
  type: string;
  data: string;
  event?: EventBridgeEvent<string, any>;
}): Promise<void> {
  const { type, data, event } = args;
  const payload = prepareEventPayload<T>({ data, type, event });
  await putEvents({ payloads: [payload] });
}

export async function putEvents<T>(args: {
  payloads: PreparedEventPayload<T>[];
}): Promise<void> {
  const { payloads } = args;
  const entries = payloads.map((payload) =>
    preparePutEventsRequestEntry(payload)
  );
  await putEventsFromEntries({ entries });
}

// eventbridge limits 10 entries per putEvent
const ENTRY_COUNT_LIMIT = 10;

async function putEventsFromEntries<
  T extends (items: I[]) => ReturnType<T>,
  I
>(args: { entries: PutEventsRequestEntry[]; event?: any }): Promise<void> {
  const eb = getEbClient();
  const { entries, event } = args;
  await batchInvoke(runPut(eb, event), ENTRY_COUNT_LIMIT, entries);
}

const runPut =
  (eb: EventBridgeClient, event?: any) =>
  async (events: PutEventsRequestEntry[]): Promise<void> => {
    const command = new PutEventsCommand({
      Entries: events,
    });
    try {
      await eb.send(command);
    } catch (e) {
      console.error(e);
    }
  };
