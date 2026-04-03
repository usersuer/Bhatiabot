import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActivityType,
} from "discord.js";
import { logger } from "../logger";

export const devCommands = [
  new SlashCommandBuilder()
    .setName("setstatus")
    .setDescription("Change the bot's status message")
    .addStringOption((opt) => opt.setName("text").setDescription("Status text to display").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("Activity type")
        .setRequired(false)
        .addChoices(
          { name: "Playing", value: "Playing" },
          { name: "Watching", value: "Watching" },
          { name: "Listening to", value: "Listening" },
          { name: "Competing in", value: "Competing" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("shutdown")
    .setDescription("Gracefully shut down the bot (requires restart to come back online)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

export async function handleDev(cmd: ChatInputCommandInteraction): Promise<boolean> {
  const { commandName } = cmd;

  if (commandName === "setstatus") {
    const text = cmd.options.getString("text", true);
    const typeStr = cmd.options.getString("type") ?? "Watching";

    const typeMap: Record<string, ActivityType> = {
      Playing: ActivityType.Playing,
      Watching: ActivityType.Watching,
      Listening: ActivityType.Listening,
      Competing: ActivityType.Competing,
    };

    const activityType = typeMap[typeStr] ?? ActivityType.Watching;
    cmd.client.user!.setActivity(text, { type: activityType });

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Status Updated")
          .setDescription(`Bot status set to: **${typeStr} ${text}**`)
          .setColor(0x2ecc71),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "shutdown") {
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⛔ Shutting Down")
          .setDescription("Bot is shutting down. Restart the workflow to bring it back online.")
          .setColor(0xe74c3c),
      ],
    });
    logger.info("Shutdown command received — exiting process");
    setTimeout(() => process.exit(0), 1000);
    return true;
  }

  return false;
}
