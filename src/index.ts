import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Interaction, ChatInputCommandInteraction, Message, TextChannel, MessageReaction, User, Partials, PermissionsBitField } from 'discord.js';
import 'dotenv/config';
import logger from './badboss/logger.js';
import { BadBoss } from './badboss/BadBoss.js';
import questionsApi from './badboss/questionsApi.js';
import pinoHttp from 'pino-http';
import cors from 'cors';

const app = express();
app.use(pinoHttp());
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax', // 'lax' works for most local dev, use 'none' + secure: true for HTTPS
    secure: false,   // set to true if using HTTPS
  },
}));

// Discord OAuth2 config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/discord/callback';

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'consent',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// @ts-expect-error
app.get('/auth/discord/callback', (async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('No code provided');
  try {
    // Exchange code for token using fetch
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
        scope: 'identify guilds',
      }),
    });
    if (!tokenRes.ok) throw new Error('Failed to fetch token');
    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;
    // Fetch user info using fetch
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new Error('Failed to fetch user info');
    const userData = await userRes.json();
    // Fetch user guilds
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!guildsRes.ok) throw new Error('Failed to fetch user guilds');
    const guilds = await guildsRes.json();
    userData.guilds = guilds;
    req.session.user = userData;
    res.redirect('/');
  } catch (err) {
    logger.error({ err }, 'Discord OAuth2 error');
    res.status(500).send('OAuth2 error');
  }
}) as any);

app.get('/api/me', (req, res) => {
  // @ts-expect-error
  if (req.session.user) {
    // @ts-expect-error
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

app.use('/api/questions', questionsApi);

// Serve static files from frontend/dist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

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

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  logger.info(`Express server running on http://localhost:${PORT}`);
});
