import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Interaction, ChatInputCommandInteraction, Message, TextChannel, MessageReaction, User, Partials, PermissionsBitField } from 'discord.js';
import 'dotenv/config';
import * as path from 'path';
import { BadBoss } from './badboss/BadBoss';
import logger from './badboss/logger';

const channelId = process.env.CHANNEL_ID;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN not set in .env');
}

const badBoss = new BadBoss();

(async () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  const commands = [
    new SlashCommandBuilder()
      .setName('trivia')
      .setDescription('Start the Bad Boss union trivia!'),
  ].map(cmd => cmd.toJSON());

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`);

    // Check permissions in all text channels
    const required = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.AddReactions,
      PermissionsBitField.Flags.ReadMessageHistory,
    ];
    const guilds = client.guilds.cache;
    for (const [guildId, guild] of guilds) {
      let channels;
      try {
        channels = await guild.channels.fetch();
      } catch (e) {
        logger.error({ error: e, guildId }, 'Failed to fetch channels for guild');
        continue;
      }
      channels.forEach(channel => {
        if (!channel || !channel.isTextBased || !channel.isTextBased()) return;
        if (channel.id !== channelId) return;
        const me = guild.members.me;
        if (!me) return;
        const perms = channel.permissionsFor(me);
        if (!perms) return;
        const missing = required.filter(perm => !perms.has(perm));
        if (missing.length > 0) {
          // Map flag values back to their string names for logging
          const flagNames = Object.entries(PermissionsBitField.Flags)
            .filter(([name, value]) => missing.includes(value as bigint))
            .map(([name]) => name);
          logger.warn({
            channel: channel.name,
            channelId: channel.id,
            guild: guild.name,
            guildId: guild.id,
            missing: flagNames
          }, 'Bot is missing permissions in channel');
        }
      });
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    logger.info({ interaction }, 'Interaction created');
    if (!interaction.isChatInputCommand()) return;
    if (interaction.channelId !== channelId) return;
    if (interaction.commandName === 'trivia') {
      await badBoss.runSession(interaction);
    }
  });

  // Register slash commands on startup
  async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN!);
    try {
      const appId = (await rest.get('/users/@me')) as any;
      await rest.put(
        Routes.applicationCommands(appId.id),
        { body: commands },
      );
      logger.info('Slash commands registered.');
    } catch (error) {
      logger.error({ error }, 'Failed to register commands');
    }
  }

  registerCommands();
  client.login(DISCORD_TOKEN);

  client.on('messageCreate', (message) => {
    if (message.channelId !== channelId) return;
    if (!client.user) return;
    const isMentioned = message.mentions.has(client.user.id);
    const isReplyToBot = message.reference && message.reference.messageId && message.channel.messages.cache.get(message.reference.messageId)?.author?.id === client.user.id;
    if (!isMentioned && !isReplyToBot) return;
    logger.info(`[LOG] Message received in #${message.channel?.id || 'unknown'} from ${message.author.tag}: ${message.content}`);
  });
})();
