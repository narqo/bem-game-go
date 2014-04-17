/* global MAKE:false */

var PATH = require('path'),
    environ = require('bem-environ')(__dirname),
    U = require('bem').util;

require('./nodes')(MAKE);

MAKE.decl('Arch', {
    blocksLevelsRegexp : /^blocks$/,
    bundlesLevelsRegexp : /^bundles$/
});

MAKE.decl('SetsNode', {
    getSets : function() {
        return {
            'game' : ['blocks']
        };
    },

    getSourceTechs : function() {
        return ['specs', 'jsdoc'];
    }
});

MAKE.decl('BundleNode', {
    /**
     * Returns a list of techs to build a bundle
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
     * Returns a list of techs that should be executed in separate process
     * @returns {Array}
     */
    getForkedTechs : function() {
        return this.__base().concat(['browser.js+bemhtml']);
    },

    /**
     * Returns a list of levels of definition to build a bundle
     * @returns {*}
     */
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

MAKE.decl('SpecNode', {
    getTechs : function() {
        return [
            'bemjson.js',
            'bemdecl.js',
            'deps.js',
            'css',
            'spec.js+browser.js+bemhtml',
            'bemhtml',
            'html',
            'phantomjs'
        ];
    },

    getForkedTechs : function() {
        return ['bemhtml', 'spec.js+browser.js+bemhtml'];
    },

    getLevels : function() {
        return this.__base.apply(this, arguments)
            .concat(PATH.resolve(this.root, 'libs/bem-pr/spec.blocks'));
    }
});
