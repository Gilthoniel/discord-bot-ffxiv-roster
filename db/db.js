const knex = require('knex');
const knexfile = require('../knexfile');

const TABLE_GUILD = 'guild';
const TABLE_CHANNEL = 'channel';
const TABLE_USER = 'user';
const TABLE_ROSTER_AVAILABLE = 'roster_available';

module.exports = {
  db: knex(knexfile),

  TABLE_GUILD,
  TABLE_CHANNEL,
  TABLE_USER,
  TABLE_ROSTER_AVAILABLE,
};
