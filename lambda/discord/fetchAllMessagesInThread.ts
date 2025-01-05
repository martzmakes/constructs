import { getSecret } from "../helpers/sm";

export const fetchAllMessagesInThread = async ({
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

  const allMessages: any[] = [];
  let before: string | undefined; // For pagination

  try {
    do {
      const url = new URL(
        `${DISCORD_API_BASE_URL}/channels/${threadId}/messages`
      );
      url.searchParams.append("limit", "100"); // Fetch up to 100 messages
      if (before) url.searchParams.append("before", before); // Fetch messages before a specific message ID

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bot ${secret.BOT_TOKEN}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error fetching messages:", error);
        break;
      }

      const messages = await response.json();
      if (messages.length > 0) {
        allMessages.push(...messages);
        before = messages[messages.length - 1].id; // Update `before` with the last message ID
      } else {
        before = undefined; // No more messages to fetch
      }
    } while (before);

    console.log(`Fetched ${allMessages.length} messages.`);
    console.log(JSON.stringify(allMessages, null, 2));
    return allMessages;
  } catch (error) {
    console.error("Error:", error);
    return allMessages;
  }
};
