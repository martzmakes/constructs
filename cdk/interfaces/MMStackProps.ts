import { StackProps } from "aws-cdk-lib";

export interface MMStackProps extends StackProps {
  envName: string;
  eventSource: string;
}