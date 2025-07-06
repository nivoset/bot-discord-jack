import { TextChannel, Message, MessageReaction, User, ChatInputCommandInteraction } from 'discord.js';
import logger from './logger.js';
import { getRandomQuestion, getGoodResponses, getBadResponses, getPossibleAnswers, type TriviaQuestion } from './QuestionsDatabase.js';

export async function sendQuestionWithReactions(
  channel: TextChannel,
  questionText: string,
  answers: string[],
  letterEmojis: string[]
): Promise<Message> {
  let msg = `:man_office_worker: **Bad Boss says:**\n> ${questionText}\n`;
  msg += answers.map((a: string, i: number) => `**${String.fromCharCode(65 + i)}.** ${a}`).join('\n');
  msg += '\n\n*Click the correct reaction below!*';
  logger.info({ msg }, 'Sending trivia question message');
  const sentMsg = await channel.send(msg);
  logger.info('Message sent, adding reactions');
  for (let i = 0; i < answers.length; ++i) {
    try {
      logger.debug({ emoji: letterEmojis[i], codePoints: Array.from(letterEmojis[i]).map(c => c.codePointAt(0)?.toString(16)) }, 'Adding reaction');
      await sentMsg.react(letterEmojis[i]);
      logger.debug({ emoji: letterEmojis[i] }, 'Reaction added');
    } catch (error: any) {
      logger.error({ error, emoji: letterEmojis[i] }, 'Failed to add reaction');
      throw error;
    }
  }
  logger.info('All reactions added');
  return sentMsg;
}

export async function askQuestion(
  channel: TextChannel,
  question: TriviaQuestion,
  possibleAnswers: string[],
  letterEmojis: string[]
): Promise<{ message: Message, correctIndex: number, answers: string[] }> {
  let answers = [question.correct_answer];
  const incorrects = Array.isArray(question.incorrect_answers) ? question.incorrect_answers.slice() : [];
  // Fill with possible answers if not enough incorrects
  while (incorrects.length < 3 && possibleAnswers.length > 0) {
    const pick = possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];
    if (!incorrects.includes(pick) && pick !== question.correct_answer) incorrects.push(pick);
  }
  answers = answers.concat(incorrects).slice(0, 4);
  answers = answers.sort(() => Math.random() - 0.5);
  logger.info('Calling sendQuestionWithReactions');
  const msg = await sendQuestionWithReactions(channel, question.question, answers, letterEmojis);
  const correctIndex = answers.findIndex((a: string) => a === question.correct_answer);
  logger.info({ correctIndex, answers }, 'Question sent with reactions');
  return { message: msg, correctIndex, answers };
}

export async function waitForAnswer(
  message: Message,
  correctIndex: number,
  letterEmojis: string[],
  userId: string,
  timeoutMs = 60_000
): Promise<boolean|null> {
  logger.info('Waiting for answer');
  return new Promise(resolve => {
    const filter = (reaction: MessageReaction, user: User) => {
      return letterEmojis.includes(reaction.emoji.name || '') && user.id === userId;
    };
    const collector = message.createReactionCollector({ filter, max: 1, time: timeoutMs });
    collector.on('collect', (reaction: MessageReaction, user: User) => {
      const pickedIndex = letterEmojis.indexOf(reaction.emoji.name || '');
      logger.info({ pickedIndex, correctIndex }, 'User answered');
      resolve(pickedIndex === correctIndex);
      collector.stop();
    });
    collector.on('end', (collected) => {
      if (collected.size === 0) {
        logger.info('No answer collected, timed out');
        resolve(null);
      }
    });
  });
}

export class BadBoss {
  constructor() {}

  async runSession(interaction: ChatInputCommandInteraction) {
    let score = 0;
    let stillPlaying = true;
    let isFirst = true;
    let channel = interaction.channel as TextChannel;
    const letterEmojis = ['🇦', '🇧', '🇨', '🇩'];
    const usedQuestions = new Set<string>();
    while (stillPlaying) {
      // Fetch a random question not used yet
      let question: TriviaQuestion | undefined;
      let attempts = 0;
      do {
        question = await getRandomQuestion();
        attempts++;
      } while (question && usedQuestions.has(question.question) && attempts < 10);
      if (!question || usedQuestions.has(question.question)) {
        logger.info('No more unique questions available.');
        break;
      }
      usedQuestions.add(question.question);
      // Fetch possible answers and responses for this round
      const possibleAnswers = await getPossibleAnswers();
      const goodResponses = await getGoodResponses();
      const badResponses = await getBadResponses();
      let fullMsg: Message;
      let correctIndex: number;
      let answers: string[];
      if (isFirst) {
        // For the first question, use interaction.reply
        let ans = [question.correct_answer];
        const incorrects = Array.isArray(question.incorrect_answers) ? question.incorrect_answers.slice() : [];
        while (incorrects.length < 3 && possibleAnswers.length > 0) {
          const pick = possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];
          if (!incorrects.includes(pick) && pick !== question.correct_answer) incorrects.push(pick);
        }
        ans = ans.concat(incorrects).slice(0, 4);
        ans = ans.sort(() => Math.random() - 0.5);
        logger.info('Replying to interaction with first question');
        await interaction.reply({ content: `:man_office_worker: **Bad Boss says:**\n> ${question.question}\n` +
          ans.map((a: string, i: number) => `**${String.fromCharCode(65 + i)}.** ${a}`).join('\n') +
          '\n\n*Click the correct reaction below!*' });
        fullMsg = await interaction.fetchReply() as Message;
        logger.info('First question sent, adding reactions');
        for (let i = 0; i < ans.length; ++i) {
          try {
            logger.debug({ emoji: letterEmojis[i], codePoints: Array.from(letterEmojis[i]).map(c => c.codePointAt(0)?.toString(16)) }, 'Adding reaction');
            await fullMsg.react(letterEmojis[i]);
            logger.debug({ emoji: letterEmojis[i] }, 'Reaction added');
          } catch (error: any) {
            logger.error({ error }, 'Failed to reply, falling back to channel.send');
            await channel.send(`:man_office_worker: Typical. Can't even answer a simple question. Time's up!`);
            break;
          }
        }
        correctIndex = ans.findIndex((a: string) => a === question.correct_answer);
        answers = ans;
        isFirst = false;
      } else {
        logger.info('Asking next question');
        const result = await askQuestion(channel, question, possibleAnswers, letterEmojis);
        fullMsg = result.message;
        correctIndex = result.correctIndex;
        answers = result.answers;
      }
      // Wait for answer
      logger.info('Waiting for user answer');
      const answered = await waitForAnswer(fullMsg, correctIndex, letterEmojis, interaction.user.id, 60_000);
      if (answered === null) {
        logger.info('User did not answer in time');
        try {
          await fullMsg.reply(`:man_office_worker: Typical. Can't even answer a simple question. Time's up!`);
        } catch (error: any) {
          logger.error({ error }, 'Failed to reply, falling back to channel.send');
          await channel.send(`:man_office_worker: Typical. Can't even answer a simple question. Time's up!`);
        }
        break;
      }
      if (answered) {
        score++;
        const good = goodResponses.length ? goodResponses[Math.floor(Math.random() * goodResponses.length)] : 'Correct!';
        logger.info('User answered correctly');
        try {
          await fullMsg.reply(`:man_office_worker: ${good}`);
        } catch (error: any) {
          logger.error({ error }, 'Failed to reply, falling back to channel.send');
          await channel.send(`:man_office_worker: ${good}`);
        }
      } else {
        const bad = badResponses.length ? badResponses[Math.floor(Math.random() * badResponses.length)] : 'Wrong!';
        logger.info('User answered incorrectly');
        try {
          await fullMsg.reply(`:man_office_worker: ${bad} The correct answer was **${letterEmojis[correctIndex]}**.`);
        } catch (error: any) {
          logger.error({ error }, 'Failed to reply, falling back to channel.send');
          await channel.send(`:man_office_worker: ${bad} The correct answer was **${letterEmojis[correctIndex]}**.`);
        }
        stillPlaying = false;
      }
    }
    if (score > 0) {
      logger.info({ score }, 'Session ended, reporting score');
      await channel.send(`You scored ${score} point${score === 1 ? '' : 's'}!`);
    }
  }
} 