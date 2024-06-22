const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('../index');

module.exports = (req, res) => {
    serveHTTP(addonInterface, { req, res });
};
