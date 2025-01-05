import { getSecret } from "../helpers/sm";

export const createFollowupMessage = async ({
  components,
  content,
  interactionToken,
  secret: incomingSecret,
}: {
  components?: any;
  content: string;
  interactionToken: string;
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
}) => {
  const secret = incomingSecret || await getSecret(process.env.DISCORD_SECRET!);
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  const { APPLICATION_ID, BOT_TOKEN } = secret;
  try {
    const url = `${DISCORD_API_BASE_URL}/webhooks/${APPLICATION_ID}/${interactionToken}`;

    const body = JSON.stringify({
      content,
      components,
    });
    console.log(body);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error responding:", error);
      return;
    }

    const data = await response.json();
    console.log("Responded successfully:", data);
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};
