import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { getTracer } from './tracer';

let cachedSecretsManagerClient: SecretsManagerClient;
export const getSecretsManagerClient = (tracer?: Tracer) => {
  if (!cachedSecretsManagerClient) {
    const myTracer = tracer ?? getTracer();

    cachedSecretsManagerClient = myTracer
      ? myTracer.captureAWSv3Client(new SecretsManagerClient({}))
      : new SecretsManagerClient({});
  }

  return cachedSecretsManagerClient;
};
