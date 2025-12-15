const Sequelize = require('sequelize');

let database = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: process.env.DB_DIALECT || 'mysql',
    pool: {
      max: 20,
      min: 5,
      min: 0,
      idle: 10000,
    },
    logging: false,
  },
);

module.exports = database;
