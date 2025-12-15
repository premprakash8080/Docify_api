
const config = {
  migrate: true,
  port: process.env.PORT || '2017',
};

 console.info(`Server running on port ${config.port}`)
module.exports = config;
