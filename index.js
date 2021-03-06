const Discord = require('discord.js');
const logger = require('./logger');
const auth = require('./auth.json');
const dispatcher = require('./dispatcher/dispatcher');
require('./helpers/moment-locale-fr');

const bot = new Discord.Client();

bot.on('ready', () => {
  logger.info('Connected');
  logger.info(`Logged in as: ${bot.user.tag}`);
});

bot.on('message', async (message) => {
  try {
    await dispatcher(message, bot);
  } catch (e) {
    logger.error(`dispatcher: ${e.stack}`);
    message.channel.send('Oops, what are you trying to do ?!');
  }
});

bot.on('error', e => logger.error(e.stack));

bot.login(auth.token);
