import {
  Client,
  GatewayIntentBits,
  TextChannel,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Interaction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { logger } from "./logger";
import {
  isMuted,
  setMuted,
  getTickerFilter,
  addTickerFilter,
  removeTickerFilter,
  clearTickerFilter,
  isTickerAllowed,
} from "./bot-state";
import { moderationCommands, handleModeration } from "./commands/moderation";
import { funCommands, handleFun } from "./commands/fun";
import { utilityCommands, handleUtility } from "./commands/utility";
import { levelingCommands, handleLeveling } from "./commands/leveling";
import { devCommands, handleDev } from "./commands/dev";

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

if (!token) throw new Error("DISCORD_BOT_TOKEN environment variable is required.");
if (!channelId) throw new Error("DISCORD_CHANNEL_ID environment variable is required.");

/**
 * Returns the list of allowed guild IDs from the DISCORD_GUILD_ID env var.
 * Supports multiple IDs separated by commas, e.g. "123,456,789"
 */
function getAllowedGuildIds(): string[] {
  const raw = process.env.DISCORD_GUILD_ID ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
  ],
});

const startedAt = new Date();

const coreCommands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available bot commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete all messages the bot has sent in a channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to clear bot messages from (defaults to current channel)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("clearall")
    .setDescription("Delete all announcement messages the bot sent across every channel in this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is alive and responsive")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show bot status: uptime, alert channel, mute state, and active filters")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute TradersPost alerts — no alerts will be sent to Discord")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute TradersPost alerts — alerts will resume")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Fire a sample TradersPost alert to the configured channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Broadcast a message — to all channels or a specific one (admin only)")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("The message to announce")
        .setRequired(true),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Target a specific channel (leave blank to send to all channels)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Manage per-ticker alert filtering")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Only send alerts for this ticker (adds to allowlist)")
        .addStringOption((opt) =>
          opt.setName("ticker").setDescription("Ticker symbol, e.g. AAPL").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a ticker from the allowlist")
        .addStringOption((opt) =>
          opt.setName("ticker").setDescription("Ticker symbol to remove").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all tickers currently in the allowlist"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear the allowlist — alerts will be sent for all tickers again"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

const commands = [
  ...coreCommands,
  ...moderationCommands,
  ...funCommands,
  ...utilityCommands,
  ...levelingCommands,
  ...devCommands,
];

async function registerCommandsForGuild(clientId: string, guildId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token!);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    logger.info({ guildId }, "Registered slash commands for guild");
  } catch (err) {
    logger.error({ err, guildId }, "Failed to register slash commands for guild");
  }
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  // Lock the bot to allowed guilds only — silently ignore any other server
  const allowedGuilds = getAllowedGuildIds();
  if (!cmd.guildId || !allowedGuilds.includes(cmd.guildId)) {
    logger.warn({ guildId: cmd.guildId }, "Rejected interaction from unlisted guild");
    await cmd.reply({ content: "This bot is not authorized to operate in this server.", ephemeral: true });
    return;
  }

  if (cmd.commandName === "help") {
    await cmd.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("🤖 Bot Commands")
          .setDescription("Admin commands are hidden from regular members. Fun/utility commands are open to everyone.")
          .setColor(0x5865f2)
          .addFields(
            {
              name: "📋 General (Admin)",
              value: [
                "`/help` — Show this command list",
                "`/ping` — Check if the bot is alive",
                "`/status` — Uptime, alert channel, mute state, and ticker filter",
              ].join("\n"),
            },
            {
              name: "🔔 TradersPost Alerts (Admin)",
              value: [
                "`/mute` — Silence all TradersPost alerts",
                "`/unmute` — Resume TradersPost alerts",
                "`/test` — Fire a sample alert to the configured channel",
              ].join("\n"),
            },
            {
              name: "📈 Ticker Filter (Admin)",
              value: [
                "`/filter add <ticker>` — Only alert for this ticker",
                "`/filter remove <ticker>` — Remove ticker from allowlist",
                "`/filter list` — View active ticker allowlist",
                "`/filter clear` — Allow all tickers again",
              ].join("\n"),
            },
            {
              name: "📢 Announcements (Admin)",
              value: [
                "`/announce message:<text>` — Broadcast to all text channels",
                "`/announce message:<text> channel:#channel` — Send to a specific channel",
              ].join("\n"),
            },
            {
              name: "🗑️ Cleanup (Admin)",
              value: [
                "`/clear` — Delete all bot messages in the current channel",
                "`/clearall` — Delete all announcement messages across every channel",
              ].join("\n"),
            },
            {
              name: "🔨 Moderation (Admin)",
              value: [
                "`/ban @user [reason]` — Ban a user",
                "`/kick @user [reason]` — Kick a user",
                "`/timeout @user <minutes> [reason]` — Temporarily mute a user",
                "`/untimeout @user` — Remove a timeout",
                "`/warn @user <reason>` — Issue a warning",
                "`/warnings @user` — View/clear warnings",
                "`/purge <amount>` — Delete recent messages",
                "`/lock [#channel]` — Lock a channel",
                "`/unlock [#channel]` — Unlock a channel",
                "`/slowmode <seconds> [#channel]` — Set slowmode",
              ].join("\n"),
            },
            {
              name: "🎮 Fun (Everyone)",
              value: [
                "`/roll [sides]` — Roll a dice",
                "`/8ball <question>` — Ask the magic 8-ball",
                "`/meme` — Random meme",
                "`/joke` — Random joke",
                "`/quote` — Inspirational quote",
                "`/cat` — Random cat picture",
                "`/dog` — Random dog picture",
                "`/trivia` — Trivia question",
                "`/avatar [@user]` — Show a user's avatar",
              ].join("\n"),
            },
            {
              name: "🔧 Utility (Everyone)",
              value: [
                "`/userinfo [@user]` — User info",
                "`/serverinfo` — Server info",
                "`/roles` — List all roles",
                "`/invite` — Bot invite link",
                "`/stats` — Server statistics",
                "`/weather <location>` — Current weather",
                "`/poll <question> [options]` — Create a poll",
              ].join("\n"),
            },
            {
              name: "⭐ Leveling (Everyone)",
              value: [
                "`/rank [@user]` — Show XP rank",
                "`/daily` — Claim daily +100 XP reward",
                "`/leaderboard` — Top 10 XP leaderboard",
              ].join("\n"),
            },
            {
              name: "⚙️ Developer (Admin)",
              value: [
                "`/setstatus <text> [type]` — Change bot's status",
                "`/shutdown` — Gracefully shut down the bot",
              ].join("\n"),
            },
          )
          .setFooter({ text: "TradersPost Discord Bot" })
          .setTimestamp(),
      ],
    });
    return;
  }

  if (cmd.commandName === "clear") {
    const targetChannel = cmd.options.getChannel("channel", false);
    const ch = (targetChannel ?? cmd.channel) as TextChannel | null;

    if (!ch || ch.type !== ChannelType.GuildText) {
      await cmd.reply({ content: "Could not find a valid text channel to clear.", ephemeral: true });
      return;
    }

    await cmd.deferReply({ ephemeral: true });

    let deleted = 0;
    let hasMore = true;
    let lastId: string | undefined;

    // Fetch in batches of 100, delete bot messages, repeat until none left
    while (hasMore) {
      const fetched = await ch.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
      if (fetched.size === 0) break;

      const botMessages = fetched.filter((m) => m.author.id === discordClient.user?.id);

      for (const msg of botMessages.values()) {
        try {
          await msg.delete();
          deleted++;
        } catch {
          // Skip messages that can't be deleted (too old, already gone, etc.)
        }
      }

      lastId = fetched.last()?.id;
      hasMore = fetched.size === 100;

      // Small pause to avoid rate limits
      if (hasMore) await new Promise((r) => setTimeout(r, 500));
    }

    logger.info({ deleted, channelId: ch.id }, "Cleared bot messages from channel");

    await cmd.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🗑️ Channel Cleared")
          .setDescription(
            deleted > 0
              ? `Deleted **${deleted}** bot message${deleted !== 1 ? "s" : ""} from <#${ch.id}>.`
              : `No bot messages found in <#${ch.id}>.`,
          )
          .setColor(deleted > 0 ? 0xff9100 : 0x9e9e9e),
      ],
    });
    return;
  }

  if (cmd.commandName === "clearall") {
    const guild = cmd.guild;
    if (!guild) {
      await cmd.reply({ content: "This command can only be used inside a server.", ephemeral: true });
      return;
    }

    await cmd.deferReply({ ephemeral: true });

    const allChannels = await guild.channels.fetch();
    // Get all text channels — skip the permission filter since guild.members.me may not be cached
    const textChannels = allChannels.filter(
      (ch): ch is TextChannel => ch !== null && ch.type === ChannelType.GuildText,
    );

    logger.info({ textChannelCount: textChannels.size }, "Scanning channels for announcements");

    let totalDeleted = 0;
    let channelsCleared = 0;

    for (const ch of textChannels.values()) {
      let hasMore = true;
      let lastId: string | undefined;
      let deletedInChannel = 0;

      try {
        while (hasMore) {
          const fetched = await ch.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
          if (fetched.size === 0) break;

          const botId = discordClient.user?.id;
          // Only target announcement messages (embeds with "Announcement" in the title)
          const announcementMessages = fetched.filter(
            (m) =>
              m.author.id === botId &&
              m.embeds.length > 0 &&
              m.embeds.some((e) => (e.title ?? "").includes("Announcement")),
          );

          logger.info(
            { channelId: ch.id, fetched: fetched.size, announcements: announcementMessages.size },
            "Scanned batch",
          );

          for (const msg of announcementMessages.values()) {
            try {
              await msg.delete();
              deletedInChannel++;
              totalDeleted++;
            } catch (err) {
              logger.warn({ err, msgId: msg.id }, "Could not delete message");
            }
          }

          lastId = fetched.last()?.id;
          hasMore = fetched.size === 100;
          if (hasMore) await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        logger.warn({ err, channelId: ch.id }, "Could not read channel history — skipping");
      }

      if (deletedInChannel > 0) channelsCleared++;
    }

    logger.info({ totalDeleted, channelsCleared, guildId: guild.id }, "Cleared announcements from all channels");

    await cmd.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🗑️ Announcements Cleared")
          .setDescription(
            totalDeleted > 0
              ? `Deleted **${totalDeleted}** announcement${totalDeleted !== 1 ? "s" : ""} across **${channelsCleared}** channel${channelsCleared !== 1 ? "s" : ""}.`
              : "No announcement messages found anywhere in the server.",
          )
          .setColor(totalDeleted > 0 ? 0xff9100 : 0x9e9e9e),
      ],
    });
    return;
  }

  if (cmd.commandName === "ping") {
    const latency = Date.now() - interaction.createdTimestamp;
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏓 Pong!")
          .setDescription("Bot is alive and responding.")
          .addFields({ name: "Latency", value: `${latency}ms`, inline: true })
          .setColor(0x5865f2)
          .setTimestamp(),
      ],
    });
    return;
  }

  if (cmd.commandName === "status") {
    const uptimeMs = Date.now() - startedAt.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
    const filters = getTickerFilter();
    const filterStr = filters.length > 0 ? filters.join(", ") : "All tickers (no filter)";
    const muted = isMuted();

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📊 Bot Status")
          .addFields(
            { name: "Status", value: "🟢 Online", inline: true },
            { name: "Uptime", value: uptimeStr, inline: true },
            { name: "Alerts", value: muted ? "🔇 Muted" : "🔔 Active", inline: true },
            { name: "Alert Channel", value: `<#${channelId}>`, inline: true },
            { name: "Ticker Filter", value: filterStr, inline: false },
          )
          .setColor(muted ? 0x9e9e9e : 0x00c853)
          .setTimestamp(),
      ],
    });
    return;
  }

  if (cmd.commandName === "mute") {
    if (isMuted()) {
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔇 Already Muted")
            .setDescription("Alerts are already muted. Use `/unmute` to re-enable them.")
            .setColor(0x9e9e9e),
        ],
      });
    } else {
      setMuted(true);
      logger.info("TradersPost alerts muted via Discord command");
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔇 Alerts Muted")
            .setDescription(
              "TradersPost alerts have been muted. No alerts will be posted until you run `/unmute`.\nThis setting is saved and will persist across restarts.",
            )
            .setColor(0x9e9e9e),
        ],
      });
    }
    return;
  }

  if (cmd.commandName === "unmute") {
    if (!isMuted()) {
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔔 Already Active")
            .setDescription("Alerts are already active. Use `/mute` to suppress them.")
            .setColor(0x00c853),
        ],
      });
    } else {
      setMuted(false);
      logger.info("TradersPost alerts unmuted via Discord command");
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔔 Alerts Resumed")
            .setDescription("TradersPost alerts are now active again. This setting is saved.")
            .setColor(0x00c853),
        ],
      });
    }
    return;
  }

  if (cmd.commandName === "test") {
    await cmd.deferReply();
    await sendDiscordAlert(
      {
        title: "BUY Signal — AAPL (Test)",
        description: "This is a **test alert** from your TradersPost Discord bot.",
        color: 0x00c853,
        fields: [
          { name: "Price", value: "$175.00", inline: true },
          { name: "Quantity", value: "10", inline: true },
          { name: "Sentiment", value: "Bullish", inline: true },
        ],
      },
      "AAPL",
      true,
    );
    await cmd.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Test Alert Sent")
          .setDescription(`A sample alert was posted to <#${channelId}>.`)
          .setColor(0x5865f2),
      ],
    });
    return;
  }

  if (cmd.commandName === "announce") {
    const message = cmd.options.getString("message", true);
    const targetChannel = cmd.options.getChannel("channel", false);
    const guild = cmd.guild;

    if (!guild) {
      await cmd.reply({ content: "This command can only be used inside a server.", ephemeral: true });
      return;
    }

    await cmd.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("📢 Announcement")
      .setDescription(message)
      .setColor(0x5865f2)
      .setFooter({ text: `Announced by ${cmd.user.tag}` })
      .setTimestamp();

    // Single channel mode
    if (targetChannel) {
      const ch = targetChannel instanceof TextChannel ? targetChannel : null;
      if (!ch) {
        await cmd.editReply({ content: "That channel is not a text channel." });
        return;
      }
      try {
        await ch.send({ embeds: [embed] });
        logger.info({ channelId: ch.id, guildId: guild.id }, "Announcement sent to single channel");
        await cmd.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Announcement Sent")
              .setDescription(`Your message was posted in <#${ch.id}>.`)
              .setColor(0x00c853),
          ],
        });
      } catch {
        await cmd.editReply({ content: `I don't have permission to send messages in <#${ch.id}>.` });
      }
      return;
    }

    // All channels mode
    const allChannels = await guild.channels.fetch();
    const textChannels = allChannels.filter(
      (ch): ch is TextChannel =>
        ch !== null &&
        ch.type === ChannelType.GuildText &&
        ch.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.SendMessages) === true,
    );

    if (textChannels.size === 0) {
      await cmd.editReply({ content: "No text channels found that I can send to." });
      return;
    }

    let sent = 0;
    let failed = 0;

    await Promise.all(
      textChannels.map(async (ch) => {
        try {
          await ch.send({ embeds: [embed] });
          sent++;
        } catch {
          failed++;
        }
      }),
    );

    logger.info({ sent, failed, guildId: guild.id }, "Announcement sent to all channels");

    await cmd.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Announcement Sent")
          .setDescription(
            `Your message was delivered to **${sent}** channel${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} skipped — no permission)` : ""}.`,
          )
          .setColor(0x00c853),
      ],
    });
    return;
  }

  if (cmd.commandName === "filter") {
    const sub = cmd.options.getSubcommand();

    if (sub === "add") {
      const ticker = cmd.options.getString("ticker", true).toUpperCase();
      const added = addTickerFilter(ticker);
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(added ? "✅ Ticker Added" : "ℹ️ Already in Filter")
            .setDescription(
              added
                ? `**${ticker}** has been added to the allowlist.\nAlerts will now only fire for: **${getTickerFilter().join(", ")}**`
                : `**${ticker}** is already in the allowlist.`,
            )
            .setColor(added ? 0x00c853 : 0x5865f2),
        ],
      });
      return;
    }

    if (sub === "remove") {
      const ticker = cmd.options.getString("ticker", true).toUpperCase();
      const removed = removeTickerFilter(ticker);
      const remaining = getTickerFilter();
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(removed ? "✅ Ticker Removed" : "ℹ️ Not in Filter")
            .setDescription(
              removed
                ? remaining.length > 0
                  ? `**${ticker}** removed. Active filter: **${remaining.join(", ")}**`
                  : `**${ticker}** removed. Filter is now empty — alerts will fire for **all tickers**.`
                : `**${ticker}** was not in the allowlist.`,
            )
            .setColor(removed ? 0xff9100 : 0x5865f2),
        ],
      });
      return;
    }

    if (sub === "list") {
      const filters = getTickerFilter();
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📋 Ticker Filter")
            .setDescription(
              filters.length > 0
                ? `Alerts are active for: **${filters.join(", ")}**`
                : "No filter set — alerts fire for **all tickers**.",
            )
            .setColor(0x5865f2),
        ],
      });
      return;
    }

    if (sub === "clear") {
      clearTickerFilter();
      await cmd.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🗑️ Filter Cleared")
            .setDescription("Ticker allowlist cleared. Alerts will now fire for **all tickers**.")
            .setColor(0xff9100),
        ],
      });
      return;
    }
  }

  if (await handleModeration(cmd)) return;
  if (await handleFun(cmd)) return;
  if (await handleUtility(cmd)) return;
  if (await handleLeveling(cmd)) return;
  if (await handleDev(cmd)) return;
}

discordClient.once("clientReady", async (client) => {
  // Administrator permission (8) — needed for moderation commands (ban, kick, timeout, manage channels, etc.)
  const inviteUrl =
    `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}` +
    `&permissions=8&scope=bot%20applications.commands`;

  logger.info({ tag: client.user.tag, clientId: client.user.id }, "Discord bot is ready");
  logger.info({ inviteUrl }, "Use this URL to invite the bot to your server");
  logger.info({ guildCount: client.guilds.cache.size }, "Bot is in guilds");

  // Only register commands for explicitly allowed guild IDs
  const allowedGuilds = getAllowedGuildIds();
  if (allowedGuilds.length === 0) {
    logger.warn("No DISCORD_GUILD_ID configured — commands will not be registered in any server");
  } else {
    logger.info({ allowedGuilds }, "Registering commands for allowed guilds");
    await Promise.all(allowedGuilds.map((id) => registerCommandsForGuild(client.user.id, id)));
  }
});

// Only register commands when joining an allowed guild
discordClient.on("guildCreate", async (guild) => {
  const allowed = getAllowedGuildIds();
  if (!allowed.includes(guild.id)) {
    logger.info(
      { guildId: guild.id, guildName: guild.name },
      "Bot joined a guild not in the allowlist — skipping command registration",
    );
    return;
  }
  logger.info({ guildId: guild.id, guildName: guild.name }, "Bot joined an allowed guild — registering commands");
  const clientId = discordClient.user?.id;
  if (clientId) {
    await registerCommandsForGuild(clientId, guild.id);
  }
});

discordClient.on("interactionCreate", (interaction) => {
  handleInteraction(interaction).catch((err) => {
    logger.error({ err }, "Error handling interaction");
  });
});

discordClient.on("error", (err) => {
  logger.error({ err }, "Discord client error");
});

export async function startDiscordBot(): Promise<void> {
  await discordClient.login(token);
}

export async function sendDiscordAlert(
  embed: {
    title: string;
    description: string;
    color: number;
    fields?: { name: string; value: string; inline?: boolean }[];
  },
  ticker?: string,
  bypassFilters = false,
): Promise<void> {
  if (!bypassFilters) {
    if (isMuted()) {
      logger.info("Alert suppressed — bot is muted");
      return;
    }
    if (ticker && !isTickerAllowed(ticker)) {
      logger.info({ ticker }, "Alert suppressed — ticker not in allowlist");
      return;
    }
  }

  const extraIds = (process.env.DISCORD_EXTRA_CHANNELS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const allChannelIds = [channelId!, ...extraIds];

  for (const id of allChannelIds) {
    try {
      const channel = await discordClient.channels.fetch(id);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.error({ channelId: id }, "Channel not found or is not a text channel");
        continue;
      }
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error({ err, channelId: id }, "Failed to send Discord alert");
    }
  }
}
