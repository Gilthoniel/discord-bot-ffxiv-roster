const logger = require('winston');
const parser = require('./parser');
const calendar = require('./calendar');

module.exports = async (message, bot) => {
  if (!message.content.startsWith('!')) {
    return;
  }

  const cmd = parser(message, bot);
  logger.info(`dispatch command "${cmd.name}"`);

  switch (cmd.name) {
    case 'add':
      await calendar.add(cmd);
      break;
    case 'check':
      await calendar.list(cmd);
      break;
    case 'reset':
      await calendar.reset(cmd);
      break;
    default:
      logger.info(`commande inconnue ${cmd.name}`);
  }
};
