import { CfnOutput, CustomResource, RemovalPolicy } from "aws-cdk-lib";
import {
  RestApi,
  EndpointType,
  LogGroupLogDestination,
  AccessLogFormat,
  MethodLoggingLevel,
  LambdaIntegration,
} from "aws-cdk-lib/aws-apigateway";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { ApiGateway } from "aws-cdk-lib/aws-route53-targets";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Lambda } from "./lambda";

export interface DiscordProps {
  domainName: string;
  discordSecretArn: string;
  interactionsLambda: Lambda;
  registerCommandLambda: Lambda;
}

export class Discord extends Construct {
  discordSecret: ISecret;
  constructor(scope: Construct, id: string, props: DiscordProps) {
    super(scope, id);

    const { discordSecretArn } = props;

    this.discordSecret = Secret.fromSecretCompleteArn(
      this,
      `DiscordSecret`,
      discordSecretArn
    );

    const hostedZone = HostedZone.fromLookup(this, "hosted-zone", {
      domainName: props.domainName,
    });
    const domainName = `discord.${props.domainName}`;
    const certificate = new Certificate(this, "cert", {
      domainName: `*.${props.domainName}`,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const logs = new LogGroup(this, `/DiscordApiLogs`, {
      logGroupName: `/DiscordApi`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new RestApi(this, `DiscordApi`, {
      description: `API for Discord`,
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new LogGroupLogDestination(logs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
      },
    });

    api.addDomainName("domain", {
      domainName,
      certificate,
    });

    new ARecord(this, "ARecord", {
      zone: hostedZone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });

    new CfnOutput(this, `DiscordUrl`, {
      value: domainName,
    });

    props.interactionsLambda.addDiscordSecret(this.discordSecret);
    api.root
      .addResource("interactions")
      .addMethod("POST", new LambdaIntegration(props.interactionsLambda.fn));

    props.registerCommandLambda.addDiscordSecret(this.discordSecret);
    this.registerCommandLambda({ lambda: props.registerCommandLambda });
  }

  registerCommandLambda = ({ lambda }: { lambda: Lambda }) => {
    const registerProvider = new Provider(this, "registerProvider", {
      onEventHandler: lambda.fn,
      logGroup: new LogGroup(this, "registerProviderLogs", {
        retention: RetentionDays.ONE_DAY,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    new CustomResource(this, "registerCommandsResource", {
      serviceToken: registerProvider.serviceToken,
      properties: {
        time: Date.now(),
      },
    });
  };
}
