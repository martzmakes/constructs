import { RemovalPolicy, Duration } from "aws-cdk-lib";
import {
  AttributeType,
  ProjectionType,
  StreamViewType,
  TableV2,
  TablePropsV2,
  GlobalSecondaryIndexPropsV2,
} from "aws-cdk-lib/aws-dynamodb";
import { Bucket, BlockPublicAccess, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import {
  DynamoEventSource,
  DynamoEventSourceProps,
} from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { existsSync } from "fs";
import { join } from "path";
import { Lambda } from "./lambda";

interface ChangeDataCapture {
  // override for function path
  functionPath?: string;
}

export interface DynamoProps {
  changeDataCapture?: boolean | ChangeDataCapture;
  gsiIndexNames?: string[];
}

export class Dynamo extends Construct {
  table: TableV2;
  constructor(scope: Construct, id: string, props: DynamoProps) {
    super(scope, id);

    const {
      changeDataCapture,
      gsiIndexNames = [] as string[],
    } = props;

    let tableProps: TablePropsV2 = {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    };

    if (changeDataCapture) {
      tableProps = {
        ...tableProps,
        dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
      };
    }

    this.table = new TableV2(this, "Table", tableProps);

    for (const gsi of gsiIndexNames) {
      const gsiCreateParams: GlobalSecondaryIndexPropsV2 = {
        indexName: gsi,
        partitionKey: { name: `${gsi}pk`, type: AttributeType.STRING },
        sortKey: { name: `${gsi}sk`, type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      };
      this.table.addGlobalSecondaryIndex(gsiCreateParams);
    }

    if (typeof changeDataCapture === "object") {
      const fn = this.createDynamoStreamHandlerFn({
        changeDataCapture,
        table: this.table,
      });
    }
  }

  createDynamoStreamHandlerFn(args: {
    changeDataCapture: ChangeDataCapture;
    table: TableV2;
  }) {
    const { changeDataCapture, table } = args;
    const { functionPath } = changeDataCapture;

    const bucket = new Bucket(this, "DynamoCDCBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      eventBridgeEnabled: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        {
          expiration: Duration.hours(24),
          enabled: true,
        },
      ],
    });

    const localMode = existsSync(
      join(__dirname, `../lambda/handlers/dynamoStreamHandler.ts`)
    );
    const entry = localMode
      ? join(__dirname, `../lambda/handlers/dynamoStreamHandler.ts`)
      : join(__dirname, `../lambda/handlers/dynamoStreamHandler.js`);
    const name = `${this.node.id}CDC`;
    const { fn } = new Lambda(this, name, {
      name,
      description: `${name}Fn - DynamoDB Stream Handler`,
      entry: functionPath || entry,
      retryAttempts: 0,
      bundling: { externalModules: [] },
      buckets: { BUCKET_NAME: { bucket, access: "rw" } },
      dynamos: { TABLE_NAME: { table, access: "rw" } },
    });

    const dynamoEventSourceProps: DynamoEventSourceProps = {
      startingPosition: StartingPosition.LATEST,
    };

    fn.addEventSource(new DynamoEventSource(table, dynamoEventSourceProps));

    return fn;
  }
}
