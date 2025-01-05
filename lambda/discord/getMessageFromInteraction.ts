import { getSecret } from "../helpers/sm";

export const getMessageFromInteraction = async ({
  interactionToken,
  secret: incomingSecret,
}: {
  interactionToken: string;
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
}) => {
  const secret = incomingSecret || await getSecret(process.env.DISCORD_SECRET!);
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  try {
    const url = `${DISCORD_API_BASE_URL}/webhooks/${secret.APPLICATION_ID}/${interactionToken}/messages/@original`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${secret.BOT_TOKEN}`, // Authorization not required for this endpoint but good practice
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error fetching message:", error);
      return;
    }

    const message = await response.json();
    console.log("Message fetched successfully:", message);
    return message;
  } catch (error) {
    console.error("Error:", error);
  }
};