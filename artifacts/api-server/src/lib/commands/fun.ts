import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

const EIGHT_BALL_RESPONSES = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes, definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
];

export const funCommands = [
  new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll a dice")
    .addIntegerOption((opt) =>
      opt.setName("sides").setDescription("Number of sides (default: 6)").setRequired(false).setMinValue(2).setMaxValue(1000),
    ),

  new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask the magic 8-ball a question")
    .addStringOption((opt) => opt.setName("question").setDescription("Your question").setRequired(true)),

  new SlashCommandBuilder().setName("meme").setDescription("Get a random meme"),

  new SlashCommandBuilder().setName("joke").setDescription("Get a random joke"),

  new SlashCommandBuilder().setName("quote").setDescription("Get an inspirational quote"),

  new SlashCommandBuilder().setName("cat").setDescription("Get a random cat picture 🐱"),

  new SlashCommandBuilder().setName("dog").setDescription("Get a random dog picture 🐶"),

  new SlashCommandBuilder().setName("trivia").setDescription("Get a random trivia question"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar")
    .addUserOption((opt) => opt.setName("user").setDescription("User to show avatar for (defaults to you)").setRequired(false)),
].map((c) => c.toJSON());

export async function handleFun(cmd: ChatInputCommandInteraction): Promise<boolean> {
  const { commandName } = cmd;

  if (commandName === "roll") {
    const sides = cmd.options.getInteger("sides") ?? 6;
    const result = Math.floor(Math.random() * sides) + 1;
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎲 Dice Roll")
          .setDescription(`You rolled a **${result}** out of **${sides}**!`)
          .setColor(0x9b59b6),
      ],
    });
    return true;
  }

  if (commandName === "8ball") {
    const question = cmd.options.getString("question", true);
    const response = EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)];
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎱 Magic 8-Ball")
          .addFields(
            { name: "Question", value: question },
            { name: "Answer", value: response },
          )
          .setColor(0x2c3e50),
      ],
    });
    return true;
  }

  if (commandName === "meme") {
    await cmd.deferReply();
    try {
      const res = await fetch("https://meme-api.com/gimme");
      const data = (await res.json()) as { title: string; url: string; subreddit: string };
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(data.title)
            .setImage(data.url)
            .setFooter({ text: `r/${data.subreddit}` })
            .setColor(0xff4500),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Couldn't fetch a meme right now. Try again!" });
    }
    return true;
  }

  if (commandName === "joke") {
    await cmd.deferReply();
    try {
      const res = await fetch("https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart");
      const data = (await res.json()) as { setup: string; delivery: string };
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("😂 Joke")
            .addFields(
              { name: "Setup", value: data.setup },
              { name: "Punchline", value: `||${data.delivery}||` },
            )
            .setColor(0xf39c12),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Couldn't fetch a joke right now. Try again!" });
    }
    return true;
  }

  if (commandName === "quote") {
    await cmd.deferReply();
    try {
      const res = await fetch("https://api.quotable.io/random");
      const data = (await res.json()) as { content: string; author: string };
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💬 Quote")
            .setDescription(`*"${data.content}"*\n\n— **${data.author}**`)
            .setColor(0x1abc9c),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Couldn't fetch a quote right now. Try again!" });
    }
    return true;
  }

  if (commandName === "cat") {
    await cmd.deferReply();
    try {
      const res = await fetch("https://api.thecatapi.com/v1/images/search");
      const data = (await res.json()) as [{ url: string }];
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🐱 Random Cat")
            .setImage(data[0].url)
            .setColor(0xff9ff3),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Couldn't fetch a cat picture right now. Try again!" });
    }
    return true;
  }

  if (commandName === "dog") {
    await cmd.deferReply();
    try {
      const res = await fetch("https://dog.ceo/api/breeds/image/random");
      const data = (await res.json()) as { message: string };
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🐶 Random Dog")
            .setImage(data.message)
            .setColor(0xffeaa7),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Couldn't fetch a dog picture right now. Try again!" });
    }
    return true;
  }

  if (commandName === "trivia") {
    await cmd.deferReply();
    try {
      const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
      const data = (await res.json()) as {
        results: [{
          question: string;
          correct_answer: string;
          incorrect_answers: string[];
          category: string;
          difficulty: string;
        }];
      };
      const q = data.results[0];
      const allAnswers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
      const decoded = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      await cmd.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧠 Trivia")
            .setDescription(`**${decoded(q.question)}**`)
            .addFields(
              { name: "Category", value: decoded(q.category), inline: true },
              { name: "Difficulty", value: q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1), inline: true },
              { name: "Options", value: allAnswers.map((a, i) => `${["🇦","🇧","🇨","🇩"][i]} ${decoded(a)}`).join("\n") },
              { name: "Answer", value: `||${decoded(q.correct_answer)}||` },
            )
            .setColor(0x3498db),
        ],
      });
    } catch {
      await cmd.editReply({ content: "Couldn't fetch a trivia question right now. Try again!" });
    }
    return true;
  }

  if (commandName === "avatar") {
    const user = cmd.options.getUser("user") ?? cmd.user;
    const avatarUrl = user.displayAvatarURL({ size: 512 });
    await cmd.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🖼️ ${user.username}'s Avatar`)
          .setImage(avatarUrl)
          .setColor(0x5865f2),
      ],
    });
    return true;
  }

  return false;
}
