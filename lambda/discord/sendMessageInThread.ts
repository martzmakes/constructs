import { getSecret } from "../helpers/sm";

export const sendMessageInThread = async ({
  secret: incomingSecret,
  threadId,
  content,
  components,
}: {
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
  threadId: string;
  content: string;
  components?: any[];
}) => {
  const secret = incomingSecret || await getSecret(process.env.DISCORD_SECRET!);
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  try {
    const url = `${DISCORD_API_BASE_URL}/channels/${threadId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${secret.BOT_TOKEN}`,
      },
      body: JSON.stringify({
        content,
        components,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error sending message:", error);
      return;
    }

    const message = await response.json();
    console.log("Message sent in thread:", message);
    return message;
  } catch (error) {
    console.error("Error:", error);
  }
};