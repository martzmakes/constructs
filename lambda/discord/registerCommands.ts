import { getSecret } from "../helpers/sm";

export const registerCommands = async ({
  commands,
  secret: incomingSecret,
}: {
  commands: any[];
  secret?: { APPLICATION_ID: string; BOT_TOKEN: string };
}) => {
  const secret =
    incomingSecret || (await getSecret(process.env.DISCORD_SECRET!));
  if (!secret) {
    console.error("No secret found");
    throw new Error("No secret found");
  }
  const { APPLICATION_ID, BOT_TOKEN } = secret;
  const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  try {
    const url = `${DISCORD_API_BASE_URL}/applications/${APPLICATION_ID}/commands`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`,
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(
        "Error registering command:",
        JSON.stringify(error, null, 2)
      );
      return;
    }

    const data = await response.json();
    console.log("Command registered successfully:", data);
  } catch (error) {
    console.error("Error:", error);
  }
};
