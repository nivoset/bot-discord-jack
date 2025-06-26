# Bad Boss Union Trivia Bot

A Discord bot that quizzes users with union-related trivia as a grumpy, union-busting boss. Answer correctly to earn points and make the boss grumpy!

## Features
- `/start` command: Starts a trivia round with a union question.
- Questions are loaded from YAML files in the `Questions/` directory.
- Written in TypeScript using discord.js, dotenv, and js-yaml.

## Setup
1. **Clone the repo and install dependencies:**
   ```sh
   npm install
   ```
2. **Create a `.env` file:**
   ```env
   DISCORD_TOKEN=your-bot-token-here
   ```
3. **Add your trivia questions:**
   - Place YAML files in the `Questions/` directory. Each file should have a `questions:` array (see example in `Questions/questions_1.union.yml`).

4. **Build and run the bot:**
   ```sh
   npm run build
   npm start
   ```
   Or for development with hot-reload:
   ```sh
   npm run dev
   ```

## Usage
- Use `/start` in your Discord server to begin a trivia round.
- The bot will ask a question and shuffle the answers. Reply with the correct letter (A, B, C, etc.).

## Adding Questions
- Add YAML files to the `Questions/` folder.
- Each file should look like:
  ```yaml
  questions:
    - question: "What is a union?"
      difficulty: "easy"
      correct_answer: "An organization of workers for collective bargaining."
      incorrect_answers:
        - "A type of sandwich."
        - "A government agency."
        - "A management club."
  ```

## License
MIT 