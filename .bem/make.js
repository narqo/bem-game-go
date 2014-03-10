/* global MAKE:false */

var PATH = require('path'),
    environ = require('bem-environ')(__dirname),
    U = require('bem').util;

require('./nodes')(MAKE);

MAKE.decl('Arch', {
    blocksLevelsRegexp : /^blocks$/,
    bundlesLevelsRegexp : /^bundles$/
});

MAKE.decl('BundleNode', {

    /**
     * Технологии сборки бандла / примера
     * @returns {Array}
     */
    getTechs : function() {
        return [
            'bemjson.js',
            'bemdecl.js',
            'deps.js',
            'css',
            'bemhtml',
            'browser.js+bemhtml',
            'html'
        ];
    },

    /**
     * Список технологий которые необходимо собирать в отдельном процессе
     * @returns {Array}
     */
    getForkedTechs : function() {
        return this.__base().concat(['browser.js+bemhtml']);
    },

    getLevels : function() {
        return [
            'libs/bem-core/common.blocks',
            'libs/bem-core/desktop.blocks',
            'blocks'
        ]
        .map(function(level) {
            return PATH.resolve(this.root, level);
        }, this)
        .concat(PATH.resolve(this.root, PATH.dirname(this.getNodePrefix()), 'blocks'));
    }

});
