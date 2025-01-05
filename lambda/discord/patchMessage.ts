import { getSecret } from "../helpers/sm";

export const patchMessage = async ({
  channelId,
  secret: incomingSecret,
  messageId,
  updatedContent,
  components,
}: {
  channelId: string;
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
  messageId: string;
  updatedContent?: string;
  components?: any[];
}) => {
  const secret = incomingSecret || await getSecret(process.env.DISCORD_SECRET!);
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  try {
    const url = `${DISCORD_API_BASE_URL}/channels/${channelId}/messages/${messageId}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${secret.BOT_TOKEN}`,
      },
      body: JSON.stringify({
        content: updatedContent, // Update message content
        components,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error updating message:", error);
      return;
    }

    const updatedMessage = await response.json();
    console.log("Message updated successfully:", updatedMessage);
    return updatedMessage;
  } catch (error) {
    console.error("Error:", error);
  }
};