const logger = require('../logger');
const parser = require('./parser');
const calendar = require('./calendar');

module.exports = async (message, bot) => {
  if (!message.content.startsWith('!')) {
    return;
  }

  const cmd = parser(message, bot);
  logger.info(`dispatch command "${cmd.name}" from user ${message.member.id}`);

  switch (cmd.name) {
    case 'dispo':
    case 'add':
      await calendar.add(cmd);
      break;
    case 'suppr':
    case 'remove':
      await calendar.remove(cmd);
      break;
    case 'copy':
      await calendar.copy(cmd);
      break;
    case 'moi':
    case 'check':
      await calendar.check(cmd);
      break;
    case 'sorties':
    case 'agg':
      await calendar.agg(cmd);
      break;
    case 'raz':
    case 'reset':
      await calendar.reset(cmd);
      break;
    default:
      logger.info(`commande inconnue ${cmd.name}`);
  }
};
