import type { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { EventPattern } from "aws-cdk-lib/aws-events";
import { SqsEventSourceProps } from "aws-cdk-lib/aws-lambda-event-sources";
import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";

export interface BucketAccessProps {
  [key: string]: {
    bucket: IBucket;
    access: "r" | "w" | "rw";
  };
}

export interface DynamoAccessProps {
  [key: string]: {
    table: ITableV2;
    access: "r" | "w" | "rw";
  };
}

export interface SecretAccessProps {
  [key: string]: {
    secret: ISecret;
    access: "r" | "w" | "rw";
  };
}

export interface LambdaProps extends NodejsFunctionProps {
  bedrock?: boolean;
  buckets?: BucketAccessProps;
  dynamos?: DynamoAccessProps;
  entry: string;
  eventPattern?: EventPattern;
  name: string;
  queue?: boolean | SqsEventSourceProps;
  secrets?: SecretAccessProps;
}
