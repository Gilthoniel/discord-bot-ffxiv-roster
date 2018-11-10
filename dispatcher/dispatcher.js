const logger = require('winston');
const parser = require('./parser');
const calendar = require('./calendar');

module.exports = (message, bot) => {
  if (!message.content.startsWith('!')) {
    return;
  }

  const cmd = parser(message, bot);
  logger.info(`dispatch command "${cmd.name}"`);

  switch (cmd.name) {
    case 'add':
      calendar.add(cmd);
      break;
    case 'check':
      calendar.list(cmd);
      break;
    case 'reset':
      calendar.reset(cmd);
      break;
    default:
      logger.info(`commande inconnue ${cmd.name}`);
  }
};
