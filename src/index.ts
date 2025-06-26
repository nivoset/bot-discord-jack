import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Interaction, ChatInputCommandInteraction, Message, TextChannel, MessageReaction, User, Partials } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BadBoss } from './badboss/BadBoss';

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN not set in .env');
}

const QUESTIONS_DIR = path.join(__dirname, '../Questions');

const badBoss = new BadBoss(QUESTIONS_DIR);

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

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
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
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

registerCommands();
client.login(DISCORD_TOKEN);

client.on('messageCreate', (message) => {
  console.log(`[LOG] Message received in #${message.channel?.id || 'unknown'} from ${message.author.tag}: ${message.content}`);
});
