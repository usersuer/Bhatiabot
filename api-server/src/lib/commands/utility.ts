import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from "discord.js";

export const utilityCommands = [
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show info about a user")
    .addUserOption((opt) => opt.setName("user").setDescription("User to look up (defaults to you)").setRequired(false)),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Show info about this server"),

  new SlashCommandBuilder().setName("roles").setDescription("List all roles in this server"),

  new SlashCommandBuilder().setName("invite").setDescription("Get the bot's invite link"),

  new SlashCommandBuilder().setName("stats").setDescription("Show server statistics"),

  new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get current weather for a location")
    .addStringOption((opt) => opt.setName("location").setDescription("City name or location").setRequired(true)),

  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .addStringOption((opt) => opt.setName("question").setDescription("The poll question").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("options").setDescription("Comma-separated options, e.g. Yes,No,Maybe (leave blank for Yes/No)").setRequired(false),
    ),
].map((c) => c.toJSON());

export async function handleUtility(cmd: ChatInputCommandInteraction): Promise<boolean> {
  const { commandName } = cmd;

  if (commandName === "userinfo") {
    const user = cmd.options.getUser("user") ?? cmd.user;
    const member = await cmd.guild!.members.fetch(user.id).catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setColor(0x5865f2)
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
        { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
      );

    if (member) {
      embed.addFields(
        { name: "Joined Server", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : "Unknown", inline: true },
        { name: "Nickname", value: member.nickname ?? "None", inline: true },
        { name: "Roles", value: member.roles.cache.filter((r) => r.id !== cmd.guildId).map((r) => r.toString()).join(", ") || "None" },
      );
    }

    await cmd.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (commandName === "serverinfo") {
    const guild = cmd.guild!;
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;
    const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🏠 ${guild.name}`)
          .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
          .setColor(0x5865f2)
          .addFields(
            { name: "ID", value: guild.id, inline: true },
            { name: "Owner", value: owner ? `${owner.user.tag}` : "Unknown", inline: true },
            { name: "Members", value: `${guild.memberCount}`, inline: true },
            { name: "Text Channels", value: `${textChannels}`, inline: true },
            { name: "Voice Channels", value: `${voiceChannels}`, inline: true },
            { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
            { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
            { name: "Boost Level", value: `${guild.premiumTier}`, inline: true },
            { name: "Boosts", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "roles") {
    const roles = cmd.guild!.roles.cache
      .filter((r) => r.id !== cmd.guildId)
      .sort((a, b) => b.position - a.position)
      .map((r) => r.toString());

    const chunks: string[] = [];
    let current = "";
    for (const r of roles) {
      if ((current + r + " ").length > 1000) {
        chunks.push(current.trim());
        current = "";
      }
      current += r + " ";
    }
    if (current) chunks.push(current.trim());

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎭 Roles in ${cmd.guild!.name}`)
          .setDescription(chunks[0] ?? "No roles found.")
          .setColor(0x9b59b6)
          .setFooter({ text: `${roles.length} total roles` }),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "invite") {
    const clientId = cmd.client.user!.id;
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔗 Invite Link")
          .setDescription(`[Click here to invite the bot](${inviteUrl})`)
          .setColor(0x5865f2),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "stats") {
    const guild = cmd.guild!;
    const onlineMembers = guild.members.cache.filter(
      (m) => m.presence?.status === "online" || m.presence?.status === "dnd" || m.presence?.status === "idle",
    ).size;

    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📊 Server Stats — ${guild.name}`)
          .setColor(0x3498db)
          .addFields(
            { name: "Total Members", value: `${guild.memberCount}`, inline: true },
            { name: "Channels", value: `${guild.channels.cache.size}`, inline: true },
            { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
            { name: "Emojis", value: `${guild.emojis.cache.size}`, inline: true },
            { name: "Stickers", value: `${guild.stickers.cache.size}`, inline: true },
            { name: "Boost Level", value: `Level ${guild.premiumTier}`, inline: true },
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (commandName === "weather") {
    const location = cmd.options.getString("location", true);
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      await cmd.reply({
        content:
          "Weather is not configured yet. An admin needs to set the `OPENWEATHER_API_KEY` environment variable (free at openweathermap.org).",
        ephemeral: true,
      });
      return true;
    }

    await cmd.deferReply();
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`,
      );
      if (!res.ok) {
        await cmd.editReply({ content: `Location "${location}" not found.` });
        return true;
      }
      const data = (await res.json()) as {
        name: string;
        sys: { country: string };
        weather: [{ description: string; icon: string }];
        main: { temp: number; feels_like: number; humidity: number };
        wind: { speed: number };
      };
      const w = data.weather[0];
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🌤️ Weather in ${data.name}, ${data.sys.country}`)
            .setDescription(`**${w.description.charAt(0).toUpperCase() + w.description.slice(1)}**`)
            .setThumbnail(`https://openweathermap.org/img/wn/${w.icon}@2x.png`)
            .addFields(
              { name: "🌡️ Temp", value: `${Math.round(data.main.temp)}°F`, inline: true },
              { name: "🤔 Feels Like", value: `${Math.round(data.main.feels_like)}°F`, inline: true },
              { name: "💧 Humidity", value: `${data.main.humidity}%`, inline: true },
              { name: "💨 Wind", value: `${Math.round(data.wind.speed)} mph`, inline: true },
            )
            .setColor(0x3498db)
            .setTimestamp(),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Failed to fetch weather data. Try again." });
    }
    return true;
  }

  if (commandName === "poll") {
    const question = cmd.options.getString("question", true);
    const optionsRaw = cmd.options.getString("options");
    const options = optionsRaw ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean) : ["Yes", "No"];
    const emojis = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

    if (options.length > 10) {
      await cmd.reply({ content: "Maximum 10 options allowed.", ephemeral: true });
      return true;
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Poll")
      .setDescription(`**${question}**\n\n${options.map((o, i) => `${emojis[i]} ${o}`).join("\n")}`)
      .setColor(0x3498db)
      .setFooter({ text: `Poll by ${cmd.user.tag}` })
      .setTimestamp();

    await cmd.reply({ embeds: [embed] });
    const msg = await cmd.fetchReply();

    if ("react" in msg) {
      for (const emoji of emojis.slice(0, options.length)) {
        await msg.react(emoji);
      }
    }
    return true;
  }

  return false;
}
