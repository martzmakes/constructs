import nacl from "tweetnacl";
import { getSecret } from "../helpers/sm";

export const verifyDiscordRequest = async ({
  body,
  headers,
}: {
  body: any;
  headers: Record<string, string>;
}) => {
  const { DISCORD_PUBLIC_KEY } = await getSecret(process.env.DISCORD_SECRET!);
  // PING request from discord, verify headers
  const signature = headers["x-signature-ed25519"];
  const timestamp = headers["x-signature-timestamp"];
  if (!signature || !timestamp) {
    return {
      statusCode: 401,
      data: {
        message: "Invalid request",
      },
    };
  }
  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + JSON.stringify(body)),
    Buffer.from(signature, "hex"),
    Buffer.from(DISCORD_PUBLIC_KEY, "hex")
  );

  if (!isVerified) {
    return {
      statusCode: 401,
      data: {
        message: "Invalid request",
      },
    };
  }

  return {
    statusCode: 200,
    data: {
      type: 1,
    },
  };
};
