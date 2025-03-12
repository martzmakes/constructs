import { decode, JwtPayload, verify } from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";

const JWKS_URL = `https://cognito-idp.us-east-1.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`;
const client = jwksClient({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  jwksUri: JWKS_URL,
});

export const getSigningKey = async (
  client: JwksClient,
  kid: string
): Promise<jwksClient.SigningKey> => {
  return new Promise<jwksClient.SigningKey>((res, rej) => {
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        rej(err);
      } else {
        res(key);
      }
    });
  });
};

// Verify the JWT token
export const verifyJwt = async (token: string): Promise<JwtPayload> => {
  const decoded = decode(token, { complete: true, json: true });
  console.log(JSON.stringify({ decoded }));

  if (!decoded || !decoded.header.kid) {
    throw new Error("Invalid token");
  }
  const key = await getSigningKey(client, decoded.header.kid);
  const signingKey = key.getPublicKey();
  if (!key) {
    throw new Error("Invalid key identifier");
  }

  return verify(token, signingKey) as JwtPayload;
};
