var environ = require('bem-environ');

module.exports = function(registry) {
    require(environ.getLibPath('bem-core', '.bem/nodes/bundle.js'))(registry);
};
