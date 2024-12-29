import { DynamoDBStreamEvent, DynamoDBRecord } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../clients/s3";
import { putEvent } from "../helpers/eb";
import { DynamoItemChangedEvent } from "../interfaces/DynamoItemChangedEvent";
import { initHandler } from "./initHandler";
import { EventDetailTypes } from "../../shared/event-detail-types";

const s3 = getS3Client();

const main = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    try {
      await processDynamoDBRecord(record);
    } catch (err) {
      // don't throw - just log so we can process the rest of the records
      console.error(JSON.stringify({ err }, null, 2));
    }
  }
};

const compareJSON = ({
  newImage,
  oldImage,
  level,
}: {
  newImage: any;
  oldImage: any;
  level: string;
}): { attributesChanged: string[]; before: any; after: any } => {
  const attributesChanged: string[] = [];
  let before: any = {};
  let after: any = {};
  const newAttributes = Object.keys(newImage || {});
  const oldAttributes = Object.keys(oldImage || {});
  const inBoth = newAttributes.filter((x) => oldAttributes.includes(x));
  const inNewOnly = newAttributes.filter((x) => !oldAttributes.includes(x));
  const inOldOnly = oldAttributes.filter((x) => !newAttributes.includes(x));
  inNewOnly.forEach((key) => {
    after[key] = newImage[key];
    attributesChanged.push(`${level}${key}`);
  });
  inOldOnly.forEach((key) => {
    before[key] = oldImage[key];
    attributesChanged.push(`${level}${key}`);
  });
  inBoth.forEach((key) => {
    if (
      typeof newImage[key] === "object" &&
      typeof oldImage[key] === "object" &&
      !Array.isArray(newImage[key]) &&
      !Array.isArray(oldImage[key])
    ) {
      const result = compareJSON({
        newImage: newImage[key],
        oldImage: oldImage[key],
        level: `${level}${key}.`,
      });
      if (result.attributesChanged.length > 0) {
        before[key] = result.before;
        after[key] = result.after;
        attributesChanged.push(`${level}${key}`, ...result.attributesChanged);
      }
    } else if (Array.isArray(newImage[key]) && Array.isArray(oldImage[key])) {
      if (JSON.stringify(newImage[key]) !== JSON.stringify(oldImage[key])) {
        before[key] = oldImage[key];
        after[key] = newImage[key];
        attributesChanged.push(`${level}${key}`);
      }
    } else {
      if (newImage[key] !== oldImage[key]) {
        before[key] = oldImage[key];
        after[key] = newImage[key];
        attributesChanged.push(`${level}${key}`);
      }
    }
  });

  return { attributesChanged, before, after };
};

async function processDynamoDBRecord(record: DynamoDBRecord) {
  console.log(JSON.stringify({ record }, null, 2));

  const operation = record.eventName; // INSERT, MODIFY, REMOVE
  if (!operation) return;
  const eventID = record.eventID; // Unique identifier for the event
  if (!eventID) return;
  const ddb = record.dynamodb; // StreamRecord containing details about the item
  if (!ddb) return;

  const size = ddb.SizeBytes;

  const keys = ddb.Keys
    ? unmarshall(ddb.Keys as { [key: string]: AttributeValue })
    : undefined;

  const newImage = ddb.NewImage
    ? unmarshall(ddb.NewImage as { [key: string]: AttributeValue })
    : undefined;
  const oldImage = ddb.OldImage
    ? unmarshall(ddb.OldImage as { [key: string]: AttributeValue })
    : undefined;

  const { attributesChanged, before, after } = compareJSON({
    newImage,
    oldImage,
    level: "",
  });

  console.log(JSON.stringify({ before, after }, null, 2));
  const itemChange: DynamoItemChangedEvent = {
    after,
    attributesChanged,
    before,
    operation,
    pk: keys?.pk,
    sk: keys?.sk,
    ...(oldImage?.type || newImage?.type
      ? { type: oldImage?.type || newImage?.type }
      : {}),
  };
  if (operation === "MODIFY" && attributesChanged.length === 0) {
    return;
  }

  const SIZE_THRESHOLD = 64 * 1024; // 64 KB
  // If the item is small enough, include the before and after images
  // in the event detail. Otherwise, upload the images to S3 and include
  // a URL to the images in the event detail.
  if (size && size < SIZE_THRESHOLD) {
    if (operation === "REMOVE") {
      itemChange.oldImage = oldImage;
    }
    itemChange.newImage = newImage;
  } else {
    const data = {
      oldImage,
      newImage,
    };
    const Key = `${eventID}.json`;
    const s3Params: PutObjectCommandInput = {
      Bucket: process.env.BUCKET_NAME,
      Key,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    };
    // Lifecycle rule will delete object after 24 hours
    await s3.send(new PutObjectCommand(s3Params));

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key,
      }),
      {
        expiresIn: 24 * 60 * 60, // 24 hours
      }
    );

    itemChange.presignedUrl = url;
  }

  console.log(JSON.stringify({ itemChange }, null, 2));
  await putEvent({
    data: JSON.stringify(itemChange),
    type: EventDetailTypes.ChangeDataCaptureDynamo,
  });
}

export const handler = initHandler({
  handler: main,
  errorOutput: {},
});
