const moment = require('moment');
const discord = require('discord.js');
const {
  db,
  TABLE_GUILD,
  TABLE_USER,
  TABLE_CHANNEL,
  TABLE_ROSTER_AVAILABLE,
} = require('../db/db');
const DayTree = require('../helpers/day-tree');

moment.locale('fr');

async function recordExists(tx, table, id) {
  const exists = await tx(table).where({ id }).first();

  return exists != null;
}

async function populateDB(tx, message) {
  const { guild, member, channel } = message;

  if (!(await recordExists(tx, TABLE_GUILD, guild.id))) {
    await tx(TABLE_GUILD).insert({ id: guild.id });
  }
  if (!(await recordExists(tx, TABLE_CHANNEL, channel.id))) {
    await tx(TABLE_CHANNEL).insert({ id: channel.id, guild_id: channel.id });
  }
  if (!(await recordExists(tx, TABLE_USER, member.id))) {
    await tx(TABLE_USER).insert({ id: member.id });
  }
}

const REGEXP_INPUT_ADD = /([a-zA-Z]{1,12})\s+([0-9]{1,2}(?:[hH]?[0-9]{1,2})?)[^0-9]+([0-9]{1,2}(?:[hH]?[0-9]{1,2})?)/;

function parseInput(input) {
  const matches = input.trim().match(REGEXP_INPUT_ADD);
  if (!matches) {
    throw new Error('bad input');
  }

  const day = DayTree.get(matches[1]);
  const startDate = moment(matches[2].toLowerCase(), 'HH[h]mm').day(day);
  const endDate = moment(matches[3].toLowerCase(), 'HH[h]mm').day(day);

  if (startDate.isBefore(moment().endOf('day'), 'minute')) {
    startDate.add(7, 'day');
    endDate.add(7, 'day');
  }

  if (endDate.isBefore(startDate)) {
    endDate.add(1, 'day');
  }

  return { startDate, endDate };
}

/**
 * Command to add a personnal event availability. It merges overlapping
 * events to prevent duplicates.
 * Syntax: !add $day $startHour $endHour
 */
exports.add = ({ message, args }) => {
  const { member, channel } = message;

  return db.transaction(async (tx) => {
    await populateDB(tx, message);

    const { startDate, endDate } = parseInput(args);

    // get existing overlapping events
    const events = await tx(TABLE_ROSTER_AVAILABLE)
      .where({ channel_id: channel.id, user_id: member.id })
      .andWhere((builder) => {
        builder.whereBetween('end_date', [startDate.toDate(), endDate.toDate()])
          .orWhereBetween('start_date', [startDate.toDate(), endDate.toDate()]);
      });

    // get the widest range of existing entries
    const minStartDate = Math.min(startDate.valueOf(), ...events.map(e => e.start_date));
    const maxEndDate = Math.max(endDate.valueOf(), ...events.map(e => e.end_date));

    // remove duplicates
    await Promise.all(events.map(e => tx(TABLE_ROSTER_AVAILABLE).where({ id: e.id }).delete()));

    await tx(TABLE_ROSTER_AVAILABLE).insert({
      user_id: member.id,
      channel_id: channel.id,
      start_date: minStartDate,
      end_date: maxEndDate,
    });

    message.reply(`disponibilité ajoutée pour ${startDate.format('dddd DD.MM')}`);
  });
};

const REGEXP_INPUT_REMOVE = /[a-zA-Z]{1,12}/;

function parseRemoveInput(args) {
  const matches = args.trim().match(REGEXP_INPUT_REMOVE);
  if (!matches) {
    throw new Error(`bad input: "${args}"`);
  }

  const day = DayTree.get(matches[0]);
  const date = moment().day(day);
  if (date.isBefore(moment().endOf('day'), 'minute')) {
    date.add(7, 'day');
  }

  return date;
}

exports.remove = ({ message, args }) => {
  const { member, channel } = message;

  return db.transaction(async (tx) => {
    await populateDB(tx, message);

    const date = parseRemoveInput(args);
    await tx(TABLE_ROSTER_AVAILABLE)
      .whereBetween('start_date', [date.startOf('day').valueOf(), date.endOf('day').valueOf()])
      .where({ user_id: member.id, channel_id: channel.id })
      .delete();

    message.reply(`${date.format('dddd')} remis à zéro`);
  });
};

exports.copy = ({ message }) => {
  const { member, channel } = message;

  return db.transaction(async (tx) => {
    await populateDB(tx, message);

    const pastMonday = moment().startOf('week');
    const pastSaturday = pastMonday.clone().add(5, 'day').endOf('day');

    // reset current week
    await tx(TABLE_ROSTER_AVAILABLE)
      .where({ user_id: member.id, channel_id: channel.id })
      .whereBetween('start_date', [pastSaturday.valueOf(), pastSaturday.clone().add(7, 'day').valueOf()])
      .delete();

    // copy past week
    const events = await tx(TABLE_ROSTER_AVAILABLE)
      .whereBetween('start_date', [pastMonday.valueOf(), pastSaturday.valueOf()])
      .where({ user_id: member.id, channel_id: channel.id });

    await Promise.all(events.map(evt => tx(TABLE_ROSTER_AVAILABLE).insert({
      user_id: member.id,
      channel_id: channel.id,
      start_date: moment(evt.start_date).add(7, 'day').toDate(),
      end_date: moment(evt.end_date).add(7, 'day').toDate(),
    })));

    message.reply('Semaine passée copiée');
  });
};

exports.reset = ({ message }) => {
  const { member, channel } = message;

  return db.transaction(async (tx) => {
    const pastMonday = moment().day(1).startOf('day');

    await tx(TABLE_ROSTER_AVAILABLE)
      .where({ user_id: member.id, channel_id: channel.id })
      .whereBetween('start_date', [pastMonday.valueOf(), pastMonday.add(7, 'day').endOf('day').valueOf()])
      .delete();

    message.reply('semaine remise à zéro!');
  });
};

function generateFields(events) {
  const fields = {};

  events.forEach((evt) => {
    const start = moment(evt.start_date);
    const end = moment(evt.end_date);
    const day = start.format('dddd DD.MM');

    if (!Object.prototype.hasOwnProperty.call(fields, day)) {
      fields[day] = '';
    }

    fields[day] += `${start.format('HH[h]mm')}-${end.format('HH[h]mm')}`;
  });

  return fields;
}

exports.check = ({ message }) => {
  const { member } = message;
  const now = moment().startOf('day');
  const lowerBound = now.valueOf();
  const upperBound = now.add(7, 'day').endOf('day').valueOf();

  return db.transaction(async (tx) => {
    const events = await tx(TABLE_ROSTER_AVAILABLE)
      .where({ user_id: member.id })
      .whereBetween('start_date', [lowerBound, upperBound])
      .orderBy('start_date');

    const fields = generateFields(events);

    if (Object.keys(fields).length > 0) {
      const msg = new discord.RichEmbed();
      msg.setDescription(`${member}`);

      Object.keys(fields).forEach(key => msg.addField(key, fields[key]));

      await message.channel.send(msg);
    } else {
      message.reply('Pas de disponibilités pour la semaine prochaine');
    }
  });
};

/**
 * Format a timestamp range into a human readable string
 * @param {int} start start date
 * @param {int} end end date
 */
function formatRange(start, end, names) {
  return `${moment(start).format('dddd DD.MM[\n]HH[h]mm')} - ${moment(end).format('HH[h]mm')} (${names.length})`;
}

/**
 * Fetch the members of the given channel to get their actual
 * nickname as it can change
 */
async function fetchMembers(tx, message) {
  const { guild, channel } = message;

  const ids = await tx(TABLE_ROSTER_AVAILABLE).select('user_id').distinct().where({ channel_id: channel.id });
  const results = await Promise.all(ids.map(id => guild.fetchMember(id.user_id).catch(() => ({ user: { id: id.user_id }, nickname: 'unknown' }))));
  const users = {};

  results.forEach(({ user, nickname }) => { users[user.id] = nickname || user.username; });
  return users;
}

function roundDate(date) {
  if (date.minutes() > 0 && date.minutes() < 30) {
    date.minutes(30);
  } else if (date.minutes() > 30) {
    date.add(1, 'hour').startOf('hour');
  }
}

function makeAggregation(events, users) {
  const agg = {};
  events.forEach((evt) => {
    const startDate = moment(evt.start_date);
    roundDate(startDate);
    const endDate = moment(evt.end_date);
    roundDate(endDate);

    while (startDate.isBefore(endDate, 'minute')) {
      const index = startDate.valueOf();

      if (!Object.prototype.hasOwnProperty.call(agg, index)) {
        agg[index] = [];
      }

      agg[index].push(users[evt.user_id]);
      startDate.add(30, 'minute');
    }
  });

  return agg;
}

function makeBuckets(agg) {
  const slots = [];
  Object.keys(agg).forEach((key) => {
    const last = slots[slots.length - 1];
    const start = parseInt(key, 10);
    const end = start + moment.duration(30, 'minutes').asMilliseconds();

    if (!last || last[1] < start || last[2].length !== agg[key].length) {
      slots.push([start, end, agg[key]]);
    } else {
      last[1] = end;
    }
  });

  return slots.sort(([aStart, aEnd, a], [bStart, bEnd, b]) => {
    if (b.length === a.length) {
      return (bEnd - bStart) - (aEnd - aStart);
    }

    return b.length - a.length;
  });
}

exports.agg = async ({ message, args }) => {
  const { channel } = message;
  const now = moment().startOf('day');
  const lowerBound = now.valueOf();
  const upperBound = now.add(7, 'day').endOf('day').valueOf();
  const size = Math.max(3, parseInt(args, 10) || 0);

  const events = await db(TABLE_ROSTER_AVAILABLE)
    .where({ channel_id: channel.id })
    .whereBetween('start_date', [lowerBound, upperBound])
    .orderBy('start_date');

  const users = await fetchMembers(db, message);
  const agg = makeAggregation(events, users);
  const slots = makeBuckets(agg);

  const msg = new discord.RichEmbed();
  msg.setTitle('Prochaines sorties');
  msg.setDescription(`Les ${size} meilleurs disponibilités pour la semaine prochaine sont données ci-dessous avec les participants et les heures`);

  slots.slice(0, size)
    .forEach(([start, end, names]) => msg.addField(formatRange(start, end, names), names.sort().join(', ')));

  await message.channel.send(msg);
};
