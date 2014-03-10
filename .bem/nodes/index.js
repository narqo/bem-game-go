module.exports = function(registry) {
    require('./common.js')(registry);
    require('./bundle.js')(registry);
};
