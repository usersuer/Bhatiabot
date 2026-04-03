import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getXP, claimDaily, getLeaderboard } from "../bot-state";

export const levelingCommands = [
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show your XP rank or another user's")
    .addUserOption((opt) => opt.setName("user").setDescription("User to check (defaults to you)").setRequired(false)),

  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily XP reward (+100 XP)"),

  new SlashCommandBuilder().setName("leaderboard").setDescription("Show the server XP leaderboard"),
].map((c) => c.toJSON());

export async function handleLeveling(cmd: ChatInputCommandInteraction): Promise<boolean> {
  const { commandName } = cmd;

  if (commandName === "rank") {
    const user = cmd.options.getUser("user") ?? cmd.user;
    const data = getXP(user.id);
    const nextLevelXP = Math.pow((data.level) / 0.1, 2);
    const progress = Math.min(100, Math.floor((data.xp / nextLevelXP) * 100));

    const bar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`⭐ ${user.username}'s Rank`)
          .setThumbnail(user.displayAvatarURL({ size: 128 }))
          .setColor(0xf1c40f)
          .addFields(
            { name: "Level", value: `${data.level}`, inline: true },
            { name: "XP", value: `${data.xp}`, inline: true },
            { name: "Next Level At", value: `${Math.floor(nextLevelXP)} XP`, inline: true },
            { name: `Progress (${progress}%)`, value: `\`${bar}\`` },
          ),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "daily") {
    const result = claimDaily(cmd.user.id);

    if (result.alreadyClaimed) {
      const lastDaily = getXP(cmd.user.id).lastDaily;
      const nextClaim = lastDaily
        ? Math.floor(new Date(lastDaily).getTime() / 1000) + 86400
        : 0;
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("⏳ Already Claimed")
            .setDescription(`You already claimed your daily reward. Come back <t:${nextClaim}:R>.`)
            .setColor(0x95a5a6),
        ],
        ephemeral: true,
      });
      return true;
    }

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎁 Daily Reward Claimed!")
          .setDescription(`You received **+100 XP**!`)
          .addFields(
            { name: "Total XP", value: `${result.xp.xp}`, inline: true },
            { name: "Level", value: `${result.xp.level}`, inline: true },
          )
          .setColor(0x2ecc71)
          .setTimestamp(),
      ],
    });
    return true;
  }

  if (commandName === "leaderboard") {
    const board = getLeaderboard();

    if (board.length === 0) {
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Leaderboard")
            .setDescription("No XP data yet. Use `/daily` to start earning XP!")
            .setColor(0xf1c40f),
        ],
        ephemeral: true,
      });
      return true;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const rows = board.map((entry, i) => {
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} <@${entry.userId}> — Level **${entry.level}** · ${entry.xp} XP`;
    });

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 XP Leaderboard")
          .setDescription(rows.join("\n"))
          .setColor(0xf1c40f)
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return true;
  }

  return false;
}
