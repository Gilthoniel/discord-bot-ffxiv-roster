
const REGEXP_CMD = /!([a-zA-Z]+)\s*(.*)/;

module.exports = (message, bot) => {
  const { content } = message;
  const match = content.toLowerCase().match(REGEXP_CMD);
  if (!match) {
    return null;
  }

  const name = match[1];
  const args = match[2];

  return {
    bot,
    message,
    name,
    args,
  };
};
