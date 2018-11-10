const Discord = require('discord.js');
const logger = require('winston');
const auth = require('./auth.json');
const dispatcher = require('./dispatcher/dispatcher');

const bot = new Discord.Client();

bot.on('ready', () => {
  logger.info('Connected');
  logger.info(`Logged in as: ${bot.user.tag}`);
});

bot.on('message', async (message) => {
  logger.info(`received message from ${message.guild.id}`);
  try {
    await dispatcher(message, bot);
  } catch (e) {
    logger.error(`dispatcher: ${e.toString()}`);
    message.channel.send('Oops, what are you trying to do ?!');
  }
});

bot.login(auth.token);
