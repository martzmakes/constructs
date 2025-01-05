import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Architecture, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { BucketAccessProps, DynamoAccessProps, LambdaProps, SecretAccessProps } from "../interfaces/LambdaProps";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { EventBus, EventPattern, Rule } from "aws-cdk-lib/aws-events";
import { MMStack } from "../stacks/MMStack";
import {
  SqsEventSource,
  SqsEventSourceProps,
} from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue, LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";

export class Lambda extends Construct {
  fn: NodejsFunction;
  name: string;
  timeout: Duration;
  constructor(scope: any, id: string, props: LambdaProps) {
    super(scope, id);

    const stack = Stack.of(this) as MMStack;

    // we're specifying the functionName and pre-creating the loggroup to help with arch sniffing
    const functionName = `${stack.lambdaBaseFnName}${props.name}`;
    this.name = functionName;
    const logGroup = new LogGroup(this, `${functionName}Logs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.timeout = props.timeout || Duration.minutes(15);

    const fn = new NodejsFunction(this, `${props.name}Fn`, {
      functionName,
      runtime: Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: this.timeout,
      architecture: Architecture.ARM_64,
      retryAttempts: 0,
      tracing: Tracing.ACTIVE,
      logGroup,
      ...props,
    });
    if (props.bedrock) {
      fn.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["bedrock:*"],
          resources: ["*"],
        })
      );
    }

    // All lambdas should have access to publish to the event bus
    const bus = EventBus.fromEventBusName(this, "EventBus", "default");
    bus.grantPutEventsTo(fn);

    fn.addEnvironment("EVENT_SOURCE", stack.eventSource);
    fn.addEnvironment("ENV_NAME", stack.envName);
    
    if (props.buckets) this.addBucketAccess(props.buckets);
    if (props.dynamos) this.addDynamoAccess(props.dynamos);
    if (props.secrets) this.addSecretAccess(props.secrets);

    this.fn = fn;
    if (props.eventPattern) {
      this.addEventBridgeTrigger({
        eventPattern: props.eventPattern,
        queue: props.queue,
      });
    }
  }

  addBucketAccess(buckets: BucketAccessProps) {
    Object.entries(buckets).forEach(([key, value]) => {
      if (value.access === "r") {
        value.bucket.grantRead(this.fn);
      } else if (value.access === "w") {
        value.bucket.grantWrite(this.fn);
      } else if (value.access === "rw") {
        value.bucket.grantReadWrite(this.fn);
      }
      this.fn.addEnvironment(key, value.bucket.bucketName);
    });
  }
  
  addDiscordSecret(secret: ISecret) {
    secret.grantRead(this.fn);
    this.fn.addEnvironment("DISCORD_SECRET", secret.secretName);
  }

  addDynamoAccess(tables: DynamoAccessProps) {
    Object.entries(tables).forEach(([key, value]) => {
      if (value.access === "r") {
        value.table.grantReadData(this.fn);
      } else if (value.access === "w") {
        value.table.grantWriteData(this.fn);
      } else if (value.access === "rw") {
        value.table.grantReadWriteData(this.fn);
      }
      this.fn.addEnvironment(key, value.table.tableName);
    });
  }

  addEventBridgeTrigger({
    eventPattern,
    queue,
  }: {
    eventPattern: EventPattern;
    queue?: boolean | SqsEventSourceProps;
  }) {
    if (queue) {
      const queue = new Queue(this, `queue-${this.name}`, {
        visibilityTimeout:
          this.timeout.plus(Duration.seconds(1)) ||
          Duration.seconds(15 * 60 + 1),
      });

      const eventSource = new SqsEventSource(queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
        maxBatchingWindow: Duration.seconds(1),
        ...(typeof queue === "object" ? queue : {}),
      });
      this.fn.addEventSource(eventSource);

      new Rule(this, `${this.name}Rule`, {
        eventPattern: eventPattern,
        targets: [new SqsQueue(queue)],
      });
    } else {
      new Rule(this, `${this.name}Rule`, {
        eventPattern: eventPattern,
        targets: [new LambdaFunction(this.fn)],
      });
    }
  }

  addSecretAccess(secrets: SecretAccessProps) {
    Object.entries(secrets).forEach(([key, value]) => {
      if (value.access === "r") {
        value.secret.grantRead(this.fn);
      } else if (value.access === "w") {
        value.secret.grantWrite(this.fn);
      } else if (value.access === "rw") {
        value.secret.grantRead(this.fn);
        value.secret.grantWrite(this.fn);
      }
      this.fn.addEnvironment(key, value.secret.secretName);
    });
  }
}
