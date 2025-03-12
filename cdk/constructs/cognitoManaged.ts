import { Annotations, CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  UserPool,
  ManagedLoginVersion,
  UserPoolClient,
  CfnManagedLoginBranding,
} from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import { MMStack } from "../stacks/MMStack";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { join } from "path";
import { Lambda } from "./lambda";

export interface CognitoManagedProps {
  redirectUrl: string;
  restApi: RestApi;
}

export class CognitoManaged extends Construct {
  signInUrl: string;
  userPoolId: string;
  constructor(scope: Construct, id: string, props: CognitoManagedProps) {
    super(scope, id);

    const { restApi } = props;

    const mmStack = Stack.of(this) as MMStack;

    const userPool = new UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
    });
    this.userPoolId = userPool.userPoolId;
    const domainPrefix =
      mmStack.envName === "prod"
        ? `${id}-auth`
        : `${id}-auth-${mmStack.envName}`;
    const domain = userPool.addDomain(
      "CognitoDomainWithBlandingDesignManagedLogin",
      {
        cognitoDomain: {
          domainPrefix,
        },
        managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
      }
    );

    const authDomain = (restApi.domainName?.domainName || restApi.url).replace(
      /^https?:\/\//,
      ""
    );
    const signedInUrl = `https://${authDomain}/signedin`;
    const client = new UserPoolClient(this, "Client", {
      userPool,
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        callbackUrls: [`https://${authDomain}/login`, signedInUrl],
      },
    });

    new CfnManagedLoginBranding(this, "ManagedLoginBranding", {
      userPoolId: userPool.userPoolId,
      clientId: client.userPoolClientId,
      returnMergedResources: true,
      useCognitoProvidedValues: true,
    });

    this.signInUrl = domain.signInUrl(client, {
      redirectUri: signedInUrl,
    });
    const authResource = restApi.root.addResource("auth");
    authResource.addResource("login").addMethod(
      "GET",
      new LambdaIntegration(
        new Lambda(this, "GetLogin", {
          entry: join(__dirname, `./prebuiltLambdas/authLogin.js`),
          environment: {
            SIGN_IN_URL: this.signInUrl,
          },
        }).fn
      )
    );
    authResource.addResource("signedin").addMethod(
      "GET",
      new LambdaIntegration(
        new Lambda(this, "GetSignedIn", {
          entry: join(__dirname, `./prebuiltLambdas/authSignedIn.js`),
          environment: {
            REDIRECT_URL: props.redirectUrl,
            SIGN_IN_URL: this.signInUrl,
            USER_POOL_ID: userPool.userPoolId,
          },
        }).fn
      )
    );
    authResource.addResource("validate").addMethod(
      "POST",
      new LambdaIntegration(
        new Lambda(this, "PostValidate", {
          entry: join(__dirname, `./prebuiltLambdas/authValidate.js`),
          environment: {
            USER_POOL_ID: userPool.userPoolId,
          },
        }).fn
      )
    );

    new CfnOutput(this, "SignInUrl", {
      value: this.signInUrl,
    });
  }
}
