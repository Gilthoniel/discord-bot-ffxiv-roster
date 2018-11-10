const {
  TABLE_GUILD,
  TABLE_CHANNEL,
  TABLE_USER,
  TABLE_ROSTER_AVAILABLE,
} = require('../db');

exports.up = async (knex) => {
  await knex.schema.createTable(TABLE_GUILD, (table) => {
    table.string('id').primary();
  });

  await knex.schema.createTable(TABLE_CHANNEL, (table) => {
    table.string('id').primary();

    table.string('guild_id')
      .references('id')
      .inTable(TABLE_GUILD)
      .notNullable();

    table.unique(['id', 'guild_id']);
  });

  await knex.schema.createTable(TABLE_USER, (table) => {
    table.string('id').primary();
  });

  await knex.schema.createTable(TABLE_ROSTER_AVAILABLE, (table) => {
    table.increments('id').primary();

    table.string('channel_id')
      .references('id')
      .inTable(TABLE_CHANNEL)
      .notNullable();

    table.string('user_id')
      .references('id')
      .inTable(TABLE_USER)
      .notNullable();

    table.dateTime('start_date').notNullable();
    table.dateTime('end_date').notNullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists(TABLE_ROSTER_AVAILABLE);
  await knex.schema.dropTableIfExists(TABLE_USER);
  await knex.schema.dropTableIfExists(TABLE_CHANNEL);
  await knex.schema.dropTableIfExists(TABLE_GUILD);
};
