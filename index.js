const Discord = require('discord.js');
const logger = require('winston');
const auth = require('./auth.json');
const dispatcher = require('./dispatcher/dispatcher');

const bot = new Discord.Client();

bot.on('ready', () => {
  logger.info('Connected');
  logger.info(`Logged in as: ${bot.user.tag}`);
});

bot.on('message', (message) => {
  logger.info(`received message from ${message.guild.id}`);
  dispatcher(message, bot);
});

bot.login(auth.token);
