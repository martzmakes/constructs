import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { MMStackProps } from "../interfaces/MMStackProps";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Dynamo } from "../constructs/dynamo";

export class MMStack extends Stack {
  envName: string;
  eventSource: string;
  lambdaBaseFnName: string;
  table?: TableV2;
  constructor(scope: Construct, id: string, props: MMStackProps) {
    super(scope, id, props);
    this.lambdaBaseFnName = `${id}`.split("-")[0].replace("Stack", "");
    this.envName = props.envName;
    this.eventSource = props.eventSource;

    if (props.table) {
      const { table } = new Dynamo(this, "Dynamo", {
        ...(props.table === true ? {} : props.table),
      });
      this.table = table;
    }
  }
}
