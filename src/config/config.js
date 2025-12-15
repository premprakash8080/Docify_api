require('dotenv').config();  // this line is important!
module.exports = {
    "development": {
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST || 'localhost',
        dialect: "mysql",
    },
    "production": {
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST || 'localhost',
        dialect: "mysql",
    },
}