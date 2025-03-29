import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

/**
 * Retrieves AWS SSO credentials using the AWS SDK credential provider for SSO.
 *
 * If the AWS_PROFILE environment variable is not set, logs an error and throws.
 *
 * @returns {Promise<any>} A promise that resolves to the obtained SSO credentials.
 * @throws {Error} If AWS_PROFILE is not set.
 *
 * @example
 * const credentials = await getSSOCredentials();
 */
export const getSSOCredentials = async (): Promise<any> => {
  if (!process.env.AWS_PROFILE) {
    const message = "AWS_PROFILE is not set, possibly not using SSO or not logged in";
    console.error({ message });
    throw new Error(message);
  }
  const { fromSSO } = await import("@aws-sdk/credential-provider-sso");
  const credentials = await fromSSO({
    profile: process.env.AWS_PROFILE,
  });

  return await credentials();
};


/**
 * Signs an HttpRequest using SignatureV4.
 *
 * If AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY are missing from the environment, it attempts
 * to retrieve SSO credentials. Then, a new SignatureV4 signer is created and used to sign the request.
 *
 * @param {HttpRequest} request - The HTTP request to sign.
 * @returns {Promise<HttpRequest>} A promise that resolves to the signed HttpRequest.
 *
 * @example
 * const signedRequest = await signRequest(request);
 */
export const signRequest = async (
  request: HttpRequest
): Promise<HttpRequest> => {
  let credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  } as any;
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    // try to get SSO credentials
    credentials = await getSSOCredentials();
  }
  const v4 = new SignatureV4({
    service: "execute-api",
    region: process.env.AWS_DEFAULT_REGION || "",
    credentials,
    sha256: Sha256,
  });
  const signedRequest = await v4.sign(request);
  return signedRequest as HttpRequest;
};
