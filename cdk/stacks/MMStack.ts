import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { MMStackProps } from "../interfaces/MMStackProps";

export class MMStack extends Stack {
  envName: string;
  eventSource: string;
  lambdaBaseFnName: string;
  constructor(scope: Construct, id: string, props: MMStackProps) {
    super(scope, id, props);
    this.lambdaBaseFnName = `${id}`.split("-")[0].replace("Stack", "");
    this.envName = props.envName;
    this.eventSource = props.eventSource;
  }
}
