import type { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { EventPattern } from 'aws-cdk-lib/aws-events';
import { SqsEventSourceProps } from "aws-cdk-lib/aws-lambda-event-sources";
import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";

export interface LambdaProps extends NodejsFunctionProps {
  bedrock?: boolean;
  buckets?: Record<string, { bucket: IBucket; access: "r" | "w" | "rw" }>;
  dynamos?: Record<string, { table: ITableV2; access: "r" | "w" | "rw" }>;
  entry: string;
  eventPattern?: EventPattern;
  name: string;
  queue?: boolean | SqsEventSourceProps;
  secrets?: Record<string, { secret: ISecret; access: "r" | "w" | "rw" }>;
}
