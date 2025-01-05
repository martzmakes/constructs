import { getSecret } from "../helpers/sm";

export const createThread = async ({
  channelId,
  secret: incomingSecret,
  messageId,
  threadName,
}: {
  channelId: string;
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
  messageId: string;
  threadName: string;
}) => {
  const secret = incomingSecret || await getSecret(process.env.DISCORD_SECRET!);
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  try {
    const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}/threads`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${secret.BOT_TOKEN}`,
      },
      body: JSON.stringify({
        name: threadName, // Name of the thread
        auto_archive_duration: 1440, // Auto-archive duration (24 hours)
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error creating thread:", error);
      return;
    }

    const thread = await response.json();
    console.log("Thread created successfully:", thread);
    return thread;
  } catch (error) {
    console.error("Error:", error);
  }
};