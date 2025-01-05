import { getSecret } from "../helpers/sm";

export const lockThread = async ({
  secret: incomingSecret,
  threadId,
}: {
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
  threadId: string;
}) => {
  const secret =
    incomingSecret || (await getSecret(process.env.DISCORD_SECRET!));
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  try {
    const url = `${DISCORD_API_BASE_URL}/channels/${threadId}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${secret.BOT_TOKEN}`,
      },
      body: JSON.stringify({
        locked: true, // Set locked to true to lock the thread
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error locking thread:", error);
      return;
    }

    const updatedThread = await response.json();
    console.log("Thread locked successfully:", updatedThread);
    return updatedThread;
  } catch (error) {
    console.error("Error:", error);
  }
};
