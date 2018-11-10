const moment = require('moment');
const logger = require('winston');
const discord = require('discord.js');
const {
  db,
  TABLE_GUILD,
  TABLE_USER,
  TABLE_CHANNEL,
  TABLE_ROSTER_AVAILABLE,
} = require('../db/db');
const DayTree = require('../helpers/day-tree');

async function recordExists(tx, table, id) {
  const exists = await tx(table).where({ id }).first();

  return exists != null;
}

const REGEXP_INPUT = /([a-zA-Z]{1,12})\s+([0-9]{1,2}(?::[0-9]{1,2})?)\s+([0-9]{1,2}(?::[0-9]{1,2})?)/;

function parseInput(input) {
  const matches = input.trim().match(REGEXP_INPUT);
  if (!matches) {
    throw new Error('bad input');
  }

  const day = DayTree.get(matches[1]);
  const startHour = parseInt(matches[2], 10);
  const endHour = parseInt(matches[3], 10);

  const startDate = moment().day(day).hour(startHour).startOf('hour');
  if (startDate.isBefore(moment())) {
    startDate.add(1, 'week');
  }

  return {
    start_date: startDate.toDate(),
    end_date: startDate.add(endHour - startHour, 'hour').toDate(),
  };
}

exports.add = async ({ message, args }) => {
  const { guild, member, channel } = message;

  try {
    await db.transaction(async (tx) => {
      if (!(await recordExists(tx, TABLE_GUILD, guild.id))) {
        await tx(TABLE_GUILD).insert({ id: guild.id });
      }
      if (!(await recordExists(tx, TABLE_CHANNEL, channel.id))) {
        await tx(TABLE_CHANNEL).insert({ id: channel.id, guild_id: channel.id });
      }
      if (!(await recordExists(tx, TABLE_USER, member.id))) {
        await tx(TABLE_USER).insert({ id: member.id });
      }

      // eslint-disable-next-line
      const { start_date, end_date } = parseInput(args);

      await tx(TABLE_ROSTER_AVAILABLE).insert({
        user_id: member.id,
        channel_id: channel.id,
        start_date,
        end_date,
      });
    });
  } catch (e) {
    logger.error(e.message);
  }
};

exports.reset = ({ message }) => {
  const { member } = message;

  try {
    db.transaction(async (tx) => {
      await tx(TABLE_ROSTER_AVAILABLE).where({ user_id: member.id }).delete();

      message.reply('Next week is cleared !');
    });
  } catch (e) {
    logger.error(e.message);
  }
};

function generateFields(events) {
  const fields = {};

  events.forEach((evt) => {
    const start = moment(evt.start_date);
    const end = moment(evt.end_date);
    const day = start.format('dddd');

    if (!Object.prototype.hasOwnProperty.call(fields, day)) {
      fields[day] = '';
    }

    fields[day] += `${start.format('HH')}h-${end.format('HH')}h `;
  });

  return fields;
}

exports.list = async ({ message }) => {
  const { member } = message;
  const now = moment().startOf('day');
  const lowerBound = now.valueOf();
  const upperBound = now.add(7, 'day').endOf('day').valueOf();

  try {
    await db.transaction(async (tx) => {
      const events = await tx(TABLE_ROSTER_AVAILABLE)
        .where({ user_id: member.id })
        .whereBetween('start_date', [lowerBound, upperBound])
        .orderBy('start_date');

      const fields = generateFields(events);

      const msg = new discord.RichEmbed();
      msg.setDescription(`${member}`);

      Object.keys(fields).forEach(key => msg.addField(key, fields[key], true));
      for (let i = 0; i < 3 - (Object.keys(fields).length % 3); i += 1) {
        msg.addBlankField(true);
      }

      message.channel.send(msg);
    });
  } catch (e) {
    logger.error(e.message);
  }
};
