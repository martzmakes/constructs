import { StackProps } from "aws-cdk-lib";
import { DynamoProps } from "../constructs/dynamo";

export interface MMStackProps extends StackProps {
  envName: string;
  eventSource: string;
  table?: boolean | DynamoProps;
}