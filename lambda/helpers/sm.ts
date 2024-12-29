import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { getSecretsManagerClient } from "../clients/sm";

const secretCache: Record<string, any> = {};
const sm = getSecretsManagerClient();

export const getSecret = async (
  secretName: string
): Promise<Record<string, any>> => {
  if (secretCache[secretName]) {
    return secretCache[secretName];
  }
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({
      SecretId: secretName,
    })
  );
  secretCache[secretName] = JSON.parse(SecretString || '{}');
  return secretCache[secretName];
};

export async function getSecretByName(args: {
  name: string,
  asString?: boolean,
}): Promise<Record<string, any> | string> {
  const { name, asString } = args;
  if (!secretCache[name]) {
    const secret = await sm.send(
      new GetSecretValueCommand({
        SecretId: name,
      })
    );
    const { SecretString, SecretBinary } = secret;
    const rawValue =
      SecretString ||
      Buffer
      .from(SecretBinary as any, "base64")
      .toString('utf-8');
    const value = asString
      ? rawValue
      : (JSON.parse(rawValue) as Record<string, any>);
    secretCache[name] = value;
  }

  return secretCache[name];
};

export const getBase64Secret = async (
  secretName: string
): Promise<string> => {
  if (secretCache[secretName]) {
    return secretCache[secretName];
  }
  const { SecretString, SecretBinary } = await sm.send(
    new GetSecretValueCommand({
      SecretId: secretName,
    })
  );
  const buff = Buffer.from(SecretString || SecretBinary as any, "base64");
  secretCache[secretName] = buff.toString('utf-8');
  return secretCache[secretName];
};
