if (process.env.NODE_ENV === 'production') {
  module.exports = {
    port: process.env.PORT,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    host: process.env.HOST,
    sessionSecret: process.env.SESSION_SECRET,
  };
} else {
  module.exports = require('./configs_dev');
}
