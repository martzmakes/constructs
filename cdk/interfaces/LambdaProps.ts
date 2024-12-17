import type { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { EventPattern } from 'aws-cdk-lib/aws-events';
import { SqsEventSourceProps } from "aws-cdk-lib/aws-lambda-event-sources";

export interface LambdaProps extends NodejsFunctionProps {
  buckets?: Record<string, { bucket: IBucket; access: "r" | "w" | "rw" }>;
  entry: string;
  eventPattern?: EventPattern;
  name: string;
  queue?: boolean | SqsEventSourceProps;
}
