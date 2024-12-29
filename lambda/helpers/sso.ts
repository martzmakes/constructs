export const getSSOCredentials = async () => {
  let credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  } as any;
  if (credentials.accessKeyId && credentials.secretAccessKey) {
    return credentials;
  }
  if (!process.env.AWS_PROFILE) {
    console.error(
      "AWS_PROFILE is not set, possibly not using SSO or not logged in"
    );
    throw new Error(
      "AWS_PROFILE is not set, possibly not using SSO or not logged in"
    );
  }
  const { fromSSO } = await import("@aws-sdk/credential-provider-sso");
  const ssoCreds = await fromSSO({
    profile: process.env.AWS_PROFILE,
  });

  return await ssoCreds();
};