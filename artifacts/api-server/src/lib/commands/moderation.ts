import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  GuildMember,
} from "discord.js";
import { logger } from "../logger";
import { addWarning, getWarnings, clearWarnings } from "../bot-state";

export const moderationCommands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption((opt) => opt.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for the ban").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption((opt) => opt.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for the kick").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily mute a user via Discord timeout")
    .addUserOption((opt) => opt.setName("user").setDescription("User to timeout").setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Duration in minutes (1–40320)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320),
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for the timeout").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a user")
    .addUserOption((opt) => opt.setName("user").setDescription("User to remove timeout from").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a user")
    .addUserOption((opt) => opt.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for the warning").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View or clear warnings for a user")
    .addUserOption((opt) => opt.setName("user").setDescription("User to check").setRequired(true))
    .addBooleanOption((opt) =>
      opt.setName("clear").setDescription("Clear all warnings for this user").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of recent messages from this channel")
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel so only admins can post")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to lock (defaults to current)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a channel so members can post again")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to unlock (defaults to current)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode delay in a channel")
    .addIntegerOption((opt) =>
      opt
        .setName("seconds")
        .setDescription("Slowmode delay in seconds (0 to disable, max 21600)")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to apply slowmode to (defaults to current)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

export async function handleModeration(cmd: ChatInputCommandInteraction): Promise<boolean> {
  const { commandName } = cmd;

  if (commandName === "ban") {
    const user = cmd.options.getUser("user", true);
    const reason = cmd.options.getString("reason") ?? "No reason provided";
    try {
      await cmd.guild!.members.ban(user.id, { reason });
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔨 User Banned")
            .addFields(
              { name: "User", value: `${user.tag} (${user.id})`, inline: true },
              { name: "Reason", value: reason, inline: true },
            )
            .setColor(0xe74c3c)
            .setTimestamp(),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to ban user");
      await cmd.reply({ content: "Failed to ban user. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  if (commandName === "kick") {
    const user = cmd.options.getUser("user", true);
    const reason = cmd.options.getString("reason") ?? "No reason provided";
    try {
      const member = await cmd.guild!.members.fetch(user.id);
      await member.kick(reason);
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👢 User Kicked")
            .addFields(
              { name: "User", value: `${user.tag} (${user.id})`, inline: true },
              { name: "Reason", value: reason, inline: true },
            )
            .setColor(0xe67e22)
            .setTimestamp(),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to kick user");
      await cmd.reply({ content: "Failed to kick user. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  if (commandName === "timeout") {
    const user = cmd.options.getUser("user", true);
    const minutes = cmd.options.getInteger("duration", true);
    const reason = cmd.options.getString("reason") ?? "No reason provided";
    try {
      const member = (await cmd.guild!.members.fetch(user.id)) as GuildMember;
      await member.timeout(minutes * 60 * 1000, reason);
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔇 User Timed Out")
            .addFields(
              { name: "User", value: `${user.tag} (${user.id})`, inline: true },
              { name: "Duration", value: `${minutes} minute${minutes !== 1 ? "s" : ""}`, inline: true },
              { name: "Reason", value: reason },
            )
            .setColor(0xf39c12)
            .setTimestamp(),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to timeout user");
      await cmd.reply({ content: "Failed to timeout user. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  if (commandName === "untimeout") {
    const user = cmd.options.getUser("user", true);
    try {
      const member = (await cmd.guild!.members.fetch(user.id)) as GuildMember;
      await member.timeout(null);
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔊 Timeout Removed")
            .setDescription(`${user.tag}'s timeout has been removed.`)
            .setColor(0x2ecc71)
            .setTimestamp(),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to remove timeout");
      await cmd.reply({ content: "Failed to remove timeout. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  if (commandName === "warn") {
    const user = cmd.options.getUser("user", true);
    const reason = cmd.options.getString("reason", true);
    const moderator = cmd.user;
    const allWarnings = addWarning(user.id, reason, moderator.id, moderator.tag);
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚠️ Warning Issued")
          .addFields(
            { name: "User", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Total Warnings", value: `${allWarnings.length}`, inline: true },
            { name: "Reason", value: reason },
          )
          .setColor(0xf1c40f)
          .setTimestamp(),
      ],
    });
    return true;
  }

  if (commandName === "warnings") {
    const user = cmd.options.getUser("user", true);
    const shouldClear = cmd.options.getBoolean("clear") ?? false;

    if (shouldClear) {
      clearWarnings(user.id);
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🗑️ Warnings Cleared")
            .setDescription(`All warnings for ${user.tag} have been cleared.`)
            .setColor(0x2ecc71),
        ],
      });
      return true;
    }

    const warns = getWarnings(user.id);
    if (warns.length === 0) {
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`⚠️ Warnings for ${user.tag}`)
            .setDescription("No warnings on record.")
            .setColor(0x95a5a6),
        ],
        ephemeral: true,
      });
      return true;
    }

    const fields = warns.map((w, i) => ({
      name: `Warning #${i + 1} — ${new Date(w.timestamp).toLocaleDateString()}`,
      value: `**Reason:** ${w.reason}\n**By:** ${w.moderatorTag}`,
    }));

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`⚠️ Warnings for ${user.tag}`)
          .setDescription(`Total: **${warns.length}** warning${warns.length !== 1 ? "s" : ""}`)
          .addFields(...fields)
          .setColor(0xf1c40f),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "purge") {
    const amount = cmd.options.getInteger("amount", true);
    const ch = cmd.channel as TextChannel;
    try {
      await cmd.deferReply({ flags: 64 });
      const deleted = await ch.bulkDelete(amount, true);
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🗑️ Messages Purged")
            .setDescription(
              `Deleted **${deleted.size}** message${deleted.size !== 1 ? "s" : ""}.\n*(Messages older than 14 days are skipped by Discord.)*`,
            )
            .setColor(0xe74c3c),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to purge messages");
      await cmd.editReply({ content: "Failed to purge messages. Check my permissions." });
    }
    return true;
  }

  if (commandName === "lock") {
    const target = (cmd.options.getChannel("channel") ?? cmd.channel) as TextChannel;
    try {
      await target.permissionOverwrites.edit(cmd.guild!.roles.everyone, {
        SendMessages: false,
      });
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔒 Channel Locked")
            .setDescription(`${target} is now locked. Members cannot send messages.`)
            .setColor(0xe74c3c),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to lock channel");
      await cmd.reply({ content: "Failed to lock channel. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  if (commandName === "unlock") {
    const target = (cmd.options.getChannel("channel") ?? cmd.channel) as TextChannel;
    try {
      await target.permissionOverwrites.edit(cmd.guild!.roles.everyone, {
        SendMessages: null,
      });
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔓 Channel Unlocked")
            .setDescription(`${target} is now unlocked. Members can send messages again.`)
            .setColor(0x2ecc71),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to unlock channel");
      await cmd.reply({ content: "Failed to unlock channel. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  if (commandName === "slowmode") {
    const seconds = cmd.options.getInteger("seconds", true);
    const target = (cmd.options.getChannel("channel") ?? cmd.channel) as TextChannel;
    try {
      await target.setRateLimitPerUser(seconds);
      const msg = seconds === 0 ? "Slowmode disabled." : `Slowmode set to **${seconds}s** in ${target}.`;
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🐢 Slowmode Updated")
            .setDescription(msg)
            .setColor(0x3498db),
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to set slowmode");
      await cmd.reply({ content: "Failed to set slowmode. Check my permissions.", ephemeral: true });
    }
    return true;
  }

  return false;
}
