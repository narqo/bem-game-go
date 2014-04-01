/* ../../libs/bem-core/node_modules/ym/modules.js begin */
/**
 * Modules
 *
 * Copyright (c) 2013 Filatov Dmitry (dfilatov@yandex-team.ru)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * @version 0.0.15
 */

(function(global) {

var undef,
    DECL_STATES = {
        NOT_RESOLVED : 'NOT_RESOLVED',
        IN_RESOLVING : 'IN_RESOLVING',
        RESOLVED     : 'RESOLVED'
    },

    /**
     * Creates a new instance of modular system
     * @returns {Object}
     */
    create = function() {
        var curOptions = {
                trackCircularDependencies : true,
                allowMultipleDeclarations : true,
                onError                   : function(e) {
                    throw e;
                }
            },

            modulesStorage = {},
            declsToCalc = [],
            waitForNextTick = false,
            pendingRequires = [],

            /**
             * Defines module
             * @param {String} name
             * @param {String[]} [deps]
             * @param {Function} declFn
             */
            define = function(name, deps, declFn) {
                if(!declFn) {
                    declFn = deps;
                    deps = [];
                }

                var module = modulesStorage[name];
                if(module) {
                    if(!curOptions.allowMultipleDeclarations) {
                        onMultipleDeclarationDetected(name);
                        return;
                    }
                }
                else {
                    module = modulesStorage[name] = {
                        name : name,
                        decl : undef
                    };
                }

                declsToCalc.push(module.decl = {
                    name          : name,
                    fn            : declFn,
                    state         : DECL_STATES.NOT_RESOLVED,
                    deps          : deps,
                    prevDecl      : module.decl,
                    dependOnDecls : [],
                    dependents    : [],
                    exports       : undef
                });
            },

            /**
             * Requires modules
             * @param {String[]} modules
             * @param {Function} cb
             */
            require = function(modules, cb) {
                if(!waitForNextTick) {
                    waitForNextTick = true;
                    nextTick(onNextTick);
                }

                pendingRequires.push({
                    modules : modules,
                    cb      : cb
                });
            },

            /**
             * Returns state of module
             * @param {String} name
             * @returns {String} state, possible values are NOT_DEFINED, NOT_RESOLVED, IN_RESOLVING, RESOLVED
             */
            getState = function(name) {
                var module = modulesStorage[name];
                return module?
                    DECL_STATES[module.decl.state] :
                    'NOT_DEFINED';
            },

            /**
             * Returns whether the module is defined
             * @param {String} name
             * @returns {Boolean}
             */
            isDefined = function(name) {
                return !!modulesStorage[name];
            },

            /**
             * Sets options
             * @param {Object} options
             */
            setOptions = function(options) {
                for(var name in options) {
                    if(options.hasOwnProperty(name)) {
                        curOptions[name] = options[name];
                    }
                }
            },

            onNextTick = function() {
                waitForNextTick = false;
                if(calcDeclDeps()) {
                    applyRequires();
                }
            },

            calcDeclDeps = function() {
                var i = 0, decl, j, dep, dependOnDecls,
                    hasError = false;
                while(decl = declsToCalc[i++]) {
                    j = 0;
                    dependOnDecls = decl.dependOnDecls;
                    while(dep = decl.deps[j++]) {
                        if(!isDefined(dep)) {
                            onModuleNotFound(dep, decl);
                            hasError = true;
                            break;
                        }
                        dependOnDecls.push(modulesStorage[dep].decl);
                    }

                    if(hasError) {
                        break;
                    }

                    if(decl.prevDecl) {
                        dependOnDecls.push(decl.prevDecl);
                        decl.prevDecl = undef;
                    }
                }

                declsToCalc = [];
                return !hasError;
            },

            applyRequires = function() {
                var requiresToProcess = pendingRequires,
                    require, i = 0, j, dep, dependOnDecls, applyCb;

                pendingRequires = [];

                while(require = requiresToProcess[i++]) {
                    j = 0; dependOnDecls = []; applyCb = true;
                    while(dep = require.modules[j++]) {
                        if(!isDefined(dep)) {
                            onModuleNotFound(dep);
                            applyCb = false;
                            break;
                        }

                        dependOnDecls.push(modulesStorage[dep].decl);
                    }
                    applyCb && applyRequire(dependOnDecls, require.cb);
                }
            },

            applyRequire = function(dependOnDecls, cb) {
                requireDecls(
                    dependOnDecls,
                    function(exports) {
                        cb.apply(global, exports);
                    },
                    []);
            },

            requireDecls = function(decls, cb, path) {
                var unresolvedDeclCnt = decls.length;

                if(unresolvedDeclCnt) {
                    var onDeclResolved,
                        i = 0, decl;

                    while(decl = decls[i++]) {
                        if(decl.state === DECL_STATES.RESOLVED) {
                            --unresolvedDeclCnt;
                        }
                        else {
                            if(curOptions.trackCircularDependencies && isDependenceCircular(decl, path)) {
                                onCircularDependenceDetected(decl, path);
                            }

                            decl.state === DECL_STATES.NOT_RESOLVED && startDeclResolving(decl, path);

                            decl.state === DECL_STATES.RESOLVED? // decl resolved synchronously
                                --unresolvedDeclCnt :
                                decl.dependents.push(onDeclResolved || (onDeclResolved = function() {
                                    --unresolvedDeclCnt || onDeclsResolved(decls, cb);
                                }));
                        }
                    }
                }

                unresolvedDeclCnt || onDeclsResolved(decls, cb);
            },

            onDeclsResolved = function(decls, cb) {
                var exports = [],
                    i = 0, decl;
                while(decl = decls[i++]) {
                    exports.push(decl.exports);
                }
                cb(exports);
            },

            startDeclResolving = function(decl, path) {
                curOptions.trackCircularDependencies && (path = path.slice()).push(decl);
                decl.state = DECL_STATES.IN_RESOLVING;
                var isProvided = false;
                requireDecls(
                    decl.dependOnDecls,
                    function(depDeclsExports) {
                        decl.fn.apply(
                            {
                                name   : decl.name,
                                deps   : decl.deps,
                                global : global
                            },
                            [function(exports) {
                                isProvided?
                                    onDeclAlreadyProvided(decl) :
                                    isProvided = true;
                                provideDecl(decl, exports);
                                return exports;
                            }].concat(depDeclsExports));
                    },
                    path);
            },

            provideDecl = function(decl, exports) {
                decl.exports = exports;
                decl.state = DECL_STATES.RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(decl.exports);
                }

                decl.dependents = undef;
            },

            onError = function(e) {
                nextTick(function() {
                    curOptions.onError(e);
                });
            },

            onModuleNotFound = function(name, decl) {
                onError(Error(
                    decl?
                        'Module "' + decl.name + '": can\'t resolve dependence "' + name + '"' :
                        'Required module "' + name + '" can\'t be resolved'));
            },

            onCircularDependenceDetected = function(decl, path) {
                var strPath = [],
                    i = 0, pathDecl;
                while(pathDecl = path[i++]) {
                    strPath.push(pathDecl.name);
                }
                strPath.push(decl.name);

                onError(Error('Circular dependence is detected: "' + strPath.join(' -> ') + '"'));
            },

            onDeclAlreadyProvided = function(decl) {
                onError(Error('Declaration of module "' + decl.name + '" is already provided'));
            },

            onMultipleDeclarationDetected = function(name) {
                onError(Error('Multiple declarations of module "' + name + '" are detected'));
            };

        return {
            create     : create,
            define     : define,
            require    : require,
            getState   : getState,
            isDefined  : isDefined,
            setOptions : setOptions
        };
    },

    isDependenceCircular = function(decl, path) {
        var i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            if(decl === pathDecl) {
                return true;
            }
        }
        return false;
    },

    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof process === 'object' && process.nextTick) { // nodejs
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.setImmediate) { // ie10
            return function(fn) {
                enqueueFn(fn) && global.setImmediate(callFns);
            };
        }

        if(global.postMessage && !global.opera) { // modern browsers
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__modules' + (+new Date()),
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var head = doc.getElementsByTagName('head')[0],
                createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                    };
                    head.appendChild(script);
                };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })();

if(typeof exports === 'object') {
    module.exports = create();
}
else {
    global.modules = create();
}

})(this);

/* ../../libs/bem-core/node_modules/ym/modules.js end */
;
/* ../../libs/bem-core/common.blocks/i-bem/i-bem.vanilla.js begin */
/**
 * @module i-bem
 */

modules.define(
    'i-bem',
    [
        'i-bem__internal',
        'inherit',
        'identify',
        'next-tick',
        'objects',
        'functions',
        'events'
    ],
    function(
        provide,
        INTERNAL,
        inherit,
        identify,
        nextTick,
        objects,
        functions,
        events) {

var undef,

    MOD_DELIM = INTERNAL.MOD_DELIM,
    ELEM_DELIM = INTERNAL.ELEM_DELIM,

    /**
     * Storage for block init functions
     * @private
     * @type Array
     */
    initFns = [],

    /**
     * Storage for block declarations (hash by block name)
     * @private
     * @type Object
     */
    blocks = {};

/**
 * Builds the name of the handler method for setting a modifier
 * @param {String} prefix
 * @param {String} modName Modifier name
 * @param {String} modVal Modifier value
 * @param {String} [elemName] Element name
 * @returns {String}
 */
function buildModFnName(prefix, modName, modVal, elemName) {
    return '__' + prefix +
        (elemName? '__elem_' + elemName : '') +
       '__mod' +
       (modName? '_' + modName : '') +
       (modVal? '_' + modVal : '');
}

/**
 * Transforms a hash of modifier handlers to methods
 * @param {String} prefix
 * @param {Object} modFns
 * @param {Object} props
 * @param {String} [elemName]
 */
function modFnsToProps(prefix, modFns, props, elemName) {
    if(functions.isFunction(modFns)) {
        props[buildModFnName(prefix, '*', '*', elemName)] = modFns;
    } else {
        var modName, modVal, modFn;
        for(modName in modFns) {
            if(modFns.hasOwnProperty(modName)) {
                modFn = modFns[modName];
                if(functions.isFunction(modFn)) {
                    props[buildModFnName(prefix, modName, '*', elemName)] = modFn;
                } else {
                    for(modVal in modFn) {
                        if(modFn.hasOwnProperty(modVal)) {
                            props[buildModFnName(prefix, modName, modVal, elemName)] = modFn[modVal];
                        }
                    }
                }
            }
        }
    }
}

function buildCheckMod(modName, modVal) {
    return modVal?
        Array.isArray(modVal)?
            function(block) {
                var i = 0, len = modVal.length;
                while(i < len)
                    if(block.hasMod(modName, modVal[i++]))
                        return true;
                return false;
            } :
            function(block) {
                return block.hasMod(modName, modVal);
            } :
        function(block) {
            return block.hasMod(modName);
        };
}

function convertModHandlersToMethods(props) {
    if(props.beforeSetMod) {
        modFnsToProps('before', props.beforeSetMod, props);
        delete props.beforeSetMod;
    }

    if(props.onSetMod) {
        modFnsToProps('after', props.onSetMod, props);
        delete props.onSetMod;
    }

    var elemName;
    if(props.beforeElemSetMod) {
        for(elemName in props.beforeElemSetMod) {
            if(props.beforeElemSetMod.hasOwnProperty(elemName)) {
                modFnsToProps('before', props.beforeElemSetMod[elemName], props, elemName);
            }
        }
        delete props.beforeElemSetMod;
    }

    if(props.onElemSetMod) {
        for(elemName in props.onElemSetMod) {
            if(props.onElemSetMod.hasOwnProperty(elemName)) {
                modFnsToProps('after', props.onElemSetMod[elemName], props, elemName);
            }
        }
        delete props.onElemSetMod;
    }
}

/**
 * @class BEM
 * @description Base block for creating BEM blocks
 * @augments events:Emitter
 * @exports
 */
var BEM = inherit(events.Emitter, /** @lends BEM.prototype */ {
    /**
     * @constructor
     * @private
     * @param {Object} mods Block modifiers
     * @param {Object} params Block parameters
     * @param {Boolean} [initImmediately=true]
     */
    __constructor : function(mods, params, initImmediately) {
        /**
         * Cache of block modifiers
         * @member {Object}
         * @private
         */
        this._modCache = mods || {};

        /**
         * Current modifiers in the stack
         * @member {Object}
         * @private
         */
        this._processingMods = {};

        /**
         * Block parameters, taking into account the defaults
         * @member {Object}
         * @readonly
         */
        this.params = objects.extend(this.getDefaultParams(), params);

        initImmediately !== false?
            this._init() :
            initFns.push(this._init, this);
    },

    /**
     * Initializes the block
     * @private
     */
    _init : function() {
        return this.setMod('js', 'inited');
    },

    /**
     * Adds an event handler
     * @param {String|Object} e Event type
     * @param {Object} [data] Additional data that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [ctx] Handler context
     * @returns {this}
     */
    on : function(e, data, fn, ctx) {
        if(typeof e === 'object' && (functions.isFunction(data) || functions.isFunction(fn))) { // mod change event
            e = this.__self._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    /**
     * Removes event handler or handlers
     * @param {String|Object} [e] Event type
     * @param {Function} [fn] Handler
     * @param {Object} [ctx] Handler context
     * @returns {this}
     */
    un : function(e, fn, ctx) {
        if(typeof e === 'object' && functions.isFunction(fn)) { // mod change event
            e = this.__self._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    /**
     * Executes the block's event handlers and live event handlers
     * @protected
     * @param {String} e Event name
     * @param {Object} [data] Additional information
     * @returns {this}
     */
    emit : function(e, data) {
        var isModJsEvent = false;
        if(typeof e === 'object' && !(e instanceof events.Event)) {
            isModJsEvent = e.modName === 'js';
            e = this.__self._buildModEventName(e);
        }

        if(isModJsEvent || this.hasMod('js', 'inited')) {
            this.__base(e = this._buildEvent(e), data);
            this._ctxEmit(e, data);
        }

        return this;
    },

    _ctxEmit : function(e, data) {
        this.__self.emit(e, data);
    },

    /**
     * Builds event
     * @private
     * @param {String|events:Event} e
     * @returns {events:Event}
     */
    _buildEvent : function(e) {
        typeof e === 'string'?
            e = new events.Event(e, this) :
            e.target || (e.target = this);

        return e;
    },

    /**
     * Checks whether a block or nested element has a modifier
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {Boolean}
     */
    hasMod : function(elem, modName, modVal) {
        var len = arguments.length,
            invert = false;

        if(len === 1) {
            modVal = '';
            modName = elem;
            elem = undef;
            invert = true;
        } else if(len === 2) {
            if(typeof elem === 'string') {
                modVal = modName;
                modName = elem;
                elem = undef;
            } else {
                modVal = '';
                invert = true;
            }
        }

        var res = this.getMod(elem, modName) === modVal;
        return invert? !res : res;
    },

    /**
     * Returns the value of the modifier of the block/nested element
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @returns {String} Modifier value
     */
    getMod : function(elem, modName) {
        var type = typeof elem;
        if(type === 'string' || type === 'undefined') { // elem either omitted or undefined
            modName = elem || modName;
            var modCache = this._modCache;
            return modName in modCache?
                modCache[modName] || '' :
                modCache[modName] = this._extractModVal(modName);
        }

        return this._getElemMod(modName, elem);
    },

    /**
     * Returns the value of the modifier of the nested element
     * @private
     * @param {String} modName Modifier name
     * @param {Object} elem Nested element
     * @param {Object} [elemName] Nested element name
     * @returns {String} Modifier value
     */
    _getElemMod : function(modName, elem, elemName) {
        return this._extractModVal(modName, elem, elemName);
    },

    /**
     * Returns values of modifiers of the block/nested element
     * @param {Object} [elem] Nested element
     * @param {String} [...modNames] Modifier names
     * @returns {Object} Hash of modifier values
     */
    getMods : function(elem) {
        var hasElem = elem && typeof elem !== 'string',
            modNames = [].slice.call(arguments, hasElem? 1 : 0),
            res = this._extractMods(modNames, hasElem? elem : undef);

        if(!hasElem) { // caching
            modNames.length?
                modNames.forEach(function(name) {
                    this._modCache[name] = res[name];
                }, this) :
                this._modCache = res;
        }

        return res;
    },

    /**
     * Sets the modifier for a block/nested element
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @returns {this}
     */
    setMod : function(elem, modName, modVal) {
        if(typeof modVal === 'undefined') {
            if(typeof elem === 'string') { // if no elem
                modVal = typeof modName === 'undefined'?
                    true :  // e.g. setMod('focused')
                    modName; // e.g. setMod('js', 'inited')
                modName = elem;
                elem = undef;
            } else { // if elem
                modVal = true; // e.g. setMod(elem, 'focused')
            }
        }

        if(!elem || elem[0]) {
            modVal === false && (modVal = '');

            var modId = (elem && elem[0]? identify(elem[0]) : '') + '_' + modName;

            if(this._processingMods[modId])
                return this;

            var elemName,
                curModVal = elem?
                    this._getElemMod(modName, elem, elemName = this.__self._extractElemNameFrom(elem)) :
                    this.getMod(modName);

            if(curModVal === modVal)
                return this;

            this._processingMods[modId] = true;

            var needSetMod = true,
                modFnParams = [modName, modVal, curModVal];

            elem && modFnParams.unshift(elem);

            var modVars = [['*', '*'], [modName, '*'], [modName, modVal]],
                prefixes = ['before', 'after'],
                i = 0, prefix, j, modVar;

            while(prefix = prefixes[i++]) {
                j = 0;
                while(modVar = modVars[j++]) {
                    if(this._callModFn(prefix, elemName, modVar[0], modVar[1], modFnParams) === false) {
                        needSetMod = false;
                        break;
                    }
                }

                if(!needSetMod) break;

                if(prefix === 'before') {
                    elem || (this._modCache[modName] = modVal); // cache only block mods
                    this._onSetMod(modName, modVal, curModVal, elem, elemName);
                }
            }

            this._processingMods[modId] = null;
            this._emitModChangeEvents(modName, modVal, curModVal, elem, elemName);
        }

        return this;
    },

    /**
     * Function after successfully changing the modifier of the block/nested element
     * @protected
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {String} oldModVal Old modifier value
     * @param {Object} [elem] Nested element
     * @param {String} [elemName] Element name
     */
    _onSetMod : function(modName, modVal, oldModVal, elem, elemName) {},

    _emitModChangeEvents : function(modName, modVal, oldModVal, elem, elemName) {
        var eventData = { modName : modName, modVal : modVal, oldModVal : oldModVal };
        elem && (eventData.elem = elem);
        this
            .emit({ modName : modName, modVal : '*', elem : elemName }, eventData)
            .emit({ modName : modName, modVal : modVal, elem : elemName }, eventData);
    },

    /**
     * Sets a modifier for a block/nested element, depending on conditions.
     * If the condition parameter is passed: when true, modVal1 is set; when false, modVal2 is set.
     * If the condition parameter is not passed: modVal1 is set if modVal2 was set, or vice versa.
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String} modVal1 First modifier value
     * @param {String} [modVal2] Second modifier value
     * @param {Boolean} [condition] Condition
     * @returns {this}
     */
    toggleMod : function(elem, modName, modVal1, modVal2, condition) {
        if(typeof elem === 'string') { // if this is a block
            condition = modVal2;
            modVal2 = modVal1;
            modVal1 = modName;
            modName = elem;
            elem = undef;
        }

        if(typeof modVal1 === 'undefined') { // boolean mod
            modVal1 = true;
        }

        if(typeof modVal2 === 'undefined') {
            modVal2 = '';
        } else if(typeof modVal2 === 'boolean') {
            condition = modVal2;
            modVal2 = '';
        }

        var modVal = this.getMod(elem, modName);
        (modVal === modVal1 || modVal === modVal2) &&
            this.setMod(
                elem,
                modName,
                typeof condition === 'boolean'?
                    (condition? modVal1 : modVal2) :
                    this.hasMod(elem, modName, modVal1)? modVal2 : modVal1);

        return this;
    },

    /**
     * Removes a modifier from a block/nested element
     * @protected
     * @param {Object} [elem] Nested element
     * @param {String} modName Modifier name
     * @returns {this}
     */
    delMod : function(elem, modName) {
        if(!modName) {
            modName = elem;
            elem = undef;
        }

        return this.setMod(elem, modName, '');
    },

    /**
     * Executes handlers for setting modifiers
     * @private
     * @param {String} prefix
     * @param {String} elemName Element name
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {Array} modFnParams Handler parameters
     */
    _callModFn : function(prefix, elemName, modName, modVal, modFnParams) {
        var modFnName = buildModFnName(prefix, modName, modVal, elemName);
        return this[modFnName]?
           this[modFnName].apply(this, modFnParams) :
           undef;
    },

    /**
     * Retrieves the value of the modifier
     * @private
     * @param {String} modName Modifier name
     * @param {Object} [elem] Element
     * @returns {String} Modifier value
     */
    _extractModVal : function(modName, elem) {
        return '';
    },

    /**
     * Retrieves name/value for a list of modifiers
     * @private
     * @param {Array} modNames Names of modifiers
     * @param {Object} [elem] Element
     * @returns {Object} Hash of modifier values by name
     */
    _extractMods : function(modNames, elem) {
        return {};
    },

    /**
     * Returns a block's default parameters
     * @protected
     * @returns {Object}
     */
    getDefaultParams : function() {
        return {};
    },

    /**
     * Deletes a block
     * @private
     */
    _destruct : function() {
        this.delMod('js');
    },

    /**
     * Executes given callback on next turn eventloop in block's context
     * @protected
     * @param {Function} fn callback
     * @returns {this}
     */
    nextTick : function(fn) {
        var _this = this;
        nextTick(function() {
            _this.hasMod('js', 'inited') && fn.call(_this);
        });
        return this;
    }
}, /** @lends BEM */{

    _name : 'i-bem',

    /**
     * Storage for block declarations (hash by block name)
     * @type Object
     */
    blocks : blocks,

    /**
     * Declares blocks and creates a block class
     * @param {String|Object} decl Block name (simple syntax) or description
     * @param {String} decl.block|decl.name Block name
     * @param {String} [decl.baseBlock] Name of the parent block
     * @param {Array} [decl.baseMix] Mixed block names
     * @param {String} [decl.modName] Modifier name
     * @param {String|Array} [decl.modVal] Modifier value
     * @param {Object} [props] Methods
     * @param {Object} [staticProps] Static methods
     * @returns {Function}
     */
    decl : function(decl, props, staticProps) {
        // string as block
        typeof decl === 'string' && (decl = { block : decl });
        // inherit from itself
        if(arguments.length <= 2 &&
                typeof decl === 'object' &&
                (!decl || (typeof decl.block !== 'string' && typeof decl.modName !== 'string'))) {
            staticProps = props;
            props = decl;
            decl = {};
        }
        typeof decl.block === 'undefined' && (decl.block = this.getName());

        var baseBlock;
        if(typeof decl.baseBlock === 'undefined')
            baseBlock = blocks[decl.block] || this;
        else if(typeof decl.baseBlock === 'string') {
            baseBlock = blocks[decl.baseBlock];
            if(!baseBlock)
                throw('baseBlock "' + decl.baseBlock + '" for "' + decl.block + '" is undefined');
        } else {
            baseBlock = decl.baseBlock;
        }

        convertModHandlersToMethods(props || (props = {}));

        if(decl.modName) {
            var checkMod = buildCheckMod(decl.modName, decl.modVal);
            objects.each(props, function(prop, name) {
                functions.isFunction(prop) &&
                    (props[name] = function() {
                        var method;
                        if(checkMod(this)) {
                            method = prop;
                        } else {
                            var baseMethod = baseBlock.prototype[name];
                            baseMethod && baseMethod !== prop &&
                                (method = this.__base);
                        }
                        return method?
                            method.apply(this, arguments) :
                            undef;
                    });
            });
        }

        if(staticProps && typeof staticProps.live === 'boolean') {
            var live = staticProps.live;
            staticProps.live = function() {
                return live;
            };
        }

        var block, baseBlocks = baseBlock;
        if(decl.baseMix) {
            baseBlocks = [baseBlocks];
            decl.baseMix.forEach(function(mixedBlock) {
                if(!blocks[mixedBlock]) {
                    throw('mix block "' + mixedBlock + '" for "' + decl.block + '" is undefined');
                }
                baseBlocks.push(blocks[mixedBlock]);
            });
        }

        decl.block === baseBlock.getName()?
            // makes a new "live" if the old one was already executed
            (block = inherit.self(baseBlocks, props, staticProps))._processLive(true) :
            (block = blocks[decl.block] = inherit(baseBlocks, props, staticProps))._name = decl.block;

        return block;
    },

    declMix : function(block, props, staticProps) {
        convertModHandlersToMethods(props || (props = {}));
        return blocks[block] = inherit(props, staticProps);
    },

    /**
     * Processes a block's live properties
     * @private
     * @param {Boolean} [heedLive=false] Whether to take into account that the block already processed its live properties
     * @returns {Boolean} Whether the block is a live block
     */
    _processLive : function(heedLive) {
        return false;
    },

    /**
     * Factory method for creating an instance of the block named
     * @param {String|Object} block Block name or description
     * @param {Object} [params] Block parameters
     * @returns {BEM}
     */
    create : function(block, params) {
        typeof block === 'string' && (block = { block : block });

        return new blocks[block.block](block.mods, params);
    },

    /**
     * Returns the name of the current block
     * @returns {String}
     */
    getName : function() {
        return this._name;
    },

    /**
     * Adds an event handler
     * @param {String|Object} e Event type
     * @param {Object} [data] Additional data that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [ctx] Handler context
     * @returns {this}
     */
    on : function(e, data, fn, ctx) {
        if(typeof e === 'object' && (functions.isFunction(data) || functions.isFunction(fn))) { // mod change event
            e = this._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    /**
     * Removes event handler or handlers
     * @param {String|Object} [e] Event type
     * @param {Function} [fn] Handler
     * @param {Object} [ctx] Handler context
     * @returns {this}
     */
    un : function(e, fn, ctx) {
        if(typeof e === 'object' && functions.isFunction(fn)) { // mod change event
            e = this._buildModEventName(e);
        }

        return this.__base.apply(this, arguments);
    },

    _buildModEventName : function(modEvent) {
        var res = MOD_DELIM + modEvent.modName + MOD_DELIM + modEvent.modVal;
        modEvent.elem && (res = ELEM_DELIM + modEvent.elem + res);
        return res;
    },

    /**
     * Retrieves the name of an element nested in a block
     * @private
     * @param {Object} elem Nested element
     * @returns {String|undefined}
     */
    _extractElemNameFrom : function(elem) {},

    /**
     * Executes the block init functions
     * @private
     */
    _runInitFns : function() {
        if(initFns.length) {
            var fns = initFns,
                fn, i = 0;

            initFns = [];
            while(fn = fns[i]) {
                fn.call(fns[i + 1]);
                i += 2;
            }
        }
    }
});

provide(BEM);

});

/* ../../libs/bem-core/common.blocks/i-bem/i-bem.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/i-bem/__internal/i-bem__internal.vanilla.js begin */
/**
 * @module i-bem__internal
 */

modules.define('i-bem__internal', function(provide) {

var undef,
    /**
     * Separator for modifiers and their values
     * @const
     * @type String
     */
    MOD_DELIM = '_',

    /**
     * Separator between names of a block and a nested element
     * @const
     * @type String
     */
    ELEM_DELIM = '__',

    /**
     * Pattern for acceptable element and modifier names
     * @const
     * @type String
     */
    NAME_PATTERN = '[a-zA-Z0-9-]+';

function isSimple(obj) {
    var typeOf = typeof obj;
    return typeOf === 'string' || typeOf === 'number' || typeOf === 'boolean';
}

function buildModPostfix(modName, modVal) {
    var res = '';
    /* jshint eqnull: true */
    if(modVal != null && modVal !== false) {
        res += MOD_DELIM + modName;
        modVal !== true && (res += MOD_DELIM + modVal);
    }
    return res;
}

function buildBlockClass(name, modName, modVal) {
    return name + buildModPostfix(modName, modVal);
}

function buildElemClass(block, name, modName, modVal) {
    return buildBlockClass(block, undef, undef) +
        ELEM_DELIM + name +
        buildModPostfix(modName, modVal);
}

provide(/** @exports */{
    NAME_PATTERN : NAME_PATTERN,

    MOD_DELIM : MOD_DELIM,
    ELEM_DELIM : ELEM_DELIM,

    buildModPostfix : buildModPostfix,

    /**
     * Builds the class of a block or element with a modifier
     * @param {String} block Block name
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String|Number} [modVal] Modifier value
     * @returns {String} Class
     */
    buildClass : function(block, elem, modName, modVal) {
        if(isSimple(modName)) {
            if(!isSimple(modVal)) {
                modVal = modName;
                modName = elem;
                elem = undef;
            }
        } else if(typeof modName !== 'undefined') {
            modName = undef;
        } else if(elem && typeof elem !== 'string') {
            elem = undef;
        }

        if(!(elem || modName)) { // optimization for simple case
            return block;
        }

        return elem?
            buildElemClass(block, elem, modName, modVal) :
            buildBlockClass(block, modName, modVal);
    },

    /**
     * Builds full classes for a buffer or element with modifiers
     * @param {String} block Block name
     * @param {String} [elem] Element name
     * @param {Object} [mods] Modifiers
     * @returns {String} Class
     */
    buildClasses : function(block, elem, mods) {
        if(elem && typeof elem !== 'string') {
            mods = elem;
            elem = undef;
        }

        var res = elem?
            buildElemClass(block, elem, undef, undef) :
            buildBlockClass(block, undef, undef);

        if(mods) {
            for(var modName in mods) {
                if(mods.hasOwnProperty(modName) && mods[modName]) {
                    res += ' ' + (elem?
                        buildElemClass(block, elem, modName, mods[modName]) :
                        buildBlockClass(block, modName, mods[modName]));
                }
            }
        }

        return res;
    }
});

});
/* ../../libs/bem-core/common.blocks/i-bem/__internal/i-bem__internal.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/inherit/inherit.vanilla.js begin */
/**
 * @module inherit
 * @version 2.2.1
 * @author Filatov Dmitry <dfilatov@yandex-team.ru>
 * @description This module provides some syntax sugar for "class" declarations, constructors, mixins, "super" calls and static members.
 */

(function(global) {

var hasIntrospection = (function(){'_';}).toString().indexOf('_') > -1,
    emptyBase = function() {},
    hasOwnProperty = Object.prototype.hasOwnProperty,
    objCreate = Object.create || function(ptp) {
        var inheritance = function() {};
        inheritance.prototype = ptp;
        return new inheritance();
    },
    objKeys = Object.keys || function(obj) {
        var res = [];
        for(var i in obj) {
            hasOwnProperty.call(obj, i) && res.push(i);
        }
        return res;
    },
    extend = function(o1, o2) {
        for(var i in o2) {
            hasOwnProperty.call(o2, i) && (o1[i] = o2[i]);
        }

        return o1;
    },
    toStr = Object.prototype.toString,
    isArray = Array.isArray || function(obj) {
        return toStr.call(obj) === '[object Array]';
    },
    isFunction = function(obj) {
        return toStr.call(obj) === '[object Function]';
    },
    noOp = function() {},
    needCheckProps = true,
    testPropObj = { toString : '' };

for(var i in testPropObj) { // fucking ie hasn't toString, valueOf in for
    testPropObj.hasOwnProperty(i) && (needCheckProps = false);
}

var specProps = needCheckProps? ['toString', 'valueOf'] : null;

function getPropList(obj) {
    var res = objKeys(obj);
    if(needCheckProps) {
        var specProp, i = 0;
        while(specProp = specProps[i++]) {
            obj.hasOwnProperty(specProp) && res.push(specProp);
        }
    }

    return res;
}

function override(base, res, add) {
    var addList = getPropList(add),
        j = 0, len = addList.length,
        name, prop;
    while(j < len) {
        if((name = addList[j++]) === '__self') {
            continue;
        }
        prop = add[name];
        if(isFunction(prop) &&
                (!hasIntrospection || prop.toString().indexOf('.__base') > -1)) {
            res[name] = (function(name, prop) {
                var baseMethod = base[name]?
                        base[name] :
                        name === '__constructor'? // case of inheritance from plane function
                            res.__self.__parent :
                            noOp;
                return function() {
                    var baseSaved = this.__base;
                    this.__base = baseMethod;
                    var res = prop.apply(this, arguments);
                    this.__base = baseSaved;
                    return res;
                };
            })(name, prop);
        } else {
            res[name] = prop;
        }
    }
}

function applyMixins(mixins, res) {
    var i = 1, mixin;
    while(mixin = mixins[i++]) {
        res?
            isFunction(mixin)?
                inherit.self(res, mixin.prototype, mixin) :
                inherit.self(res, mixin) :
            res = isFunction(mixin)?
                inherit(mixins[0], mixin.prototype, mixin) :
                inherit(mixins[0], mixin);
    }
    return res || mixins[0];
}

/**
* Creates class
* @exports
* @param {Function|Array} [baseClass|baseClassAndMixins] class (or class and mixins) to inherit from
* @param {Object} prototypeFields
* @param {Object} [staticFields]
* @returns {Function} class
*/
function inherit() {
    var args = arguments,
        withMixins = isArray(args[0]),
        hasBase = withMixins || isFunction(args[0]),
        base = hasBase? withMixins? applyMixins(args[0]) : args[0] : emptyBase,
        props = args[hasBase? 1 : 0] || {},
        staticProps = args[hasBase? 2 : 1],
        res = props.__constructor || (hasBase && base.prototype.__constructor)?
            function() {
                return this.__constructor.apply(this, arguments);
            } :
            hasBase?
                function() {
                    return base.apply(this, arguments);
                } :
                function() {};

    if(!hasBase) {
        res.prototype = props;
        res.prototype.__self = res.prototype.constructor = res;
        return extend(res, staticProps);
    }

    extend(res, base);

    res.__parent = base;

    var basePtp = base.prototype,
        resPtp = res.prototype = objCreate(basePtp);

    resPtp.__self = resPtp.constructor = res;

    props && override(basePtp, resPtp, props);
    staticProps && override(base, res, staticProps);

    return res;
}

inherit.self = function() {
    var args = arguments,
        withMixins = isArray(args[0]),
        base = withMixins? applyMixins(args[0], args[0][0]) : args[0],
        props = args[1],
        staticProps = args[2],
        basePtp = base.prototype;

    props && override(basePtp, basePtp, props);
    staticProps && override(base, base, staticProps);

    return base;
};

var defineAsGlobal = true;
if(typeof exports === 'object') {
    module.exports = inherit;
    defineAsGlobal = false;
}

if(typeof modules === 'object') {
    modules.define('inherit', function(provide) {
        provide(inherit);
    });
    defineAsGlobal = false;
}

if(typeof define === 'function') {
    define(function(require, exports, module) {
        module.exports = inherit;
    });
    defineAsGlobal = false;
}

defineAsGlobal && (global.inherit = inherit);

})(this);

/* ../../libs/bem-core/common.blocks/inherit/inherit.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/identify/identify.vanilla.js begin */
/**
 * @module identify
 */

modules.define('identify', function(provide) {

var counter = 0,
    expando = '__' + (+new Date),
    get = function() {
        return 'uniq' + (++counter);
    };

provide(
    /**
     * Makes unique ID
     * @exports
     * @param {Object} obj Object that needs to be identified
     * @param {Boolean} [onlyGet=false] Return a unique value only if it had already been assigned before
     * @returns {String} ID
     */
    function(obj, onlyGet) {
        if(!obj) return get();

        var key = 'uniqueID' in obj? 'uniqueID' : expando; // Use when possible native uniqueID for elements in IE

        return onlyGet || key in obj?
            obj[key] :
            obj[key] = get();
    }
);

});

/* ../../libs/bem-core/common.blocks/identify/identify.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/next-tick/next-tick.vanilla.js begin */
/**
 * @module next-tick
 */

modules.define('next-tick', function(provide) {

/**
 * Executes given function on next tick.
 * @exports
 * @type Function
 * @param {Function} fn
 */

var global = this.global,
    fns = [],
    enqueueFn = function(fn) {
        return fns.push(fn) === 1;
    },
    callFns = function() {
        var fnsToCall = fns, i = 0, len = fns.length;
        fns = [];
        while(i < len) {
            fnsToCall[i++]();
        }
    };

    /* global process */
    if(typeof process === 'object' && process.nextTick) { // nodejs
        return provide(function(fn) {
            enqueueFn(fn) && process.nextTick(callFns);
        });
    }

    if(global.setImmediate) { // ie10
        return provide(function(fn) {
            enqueueFn(fn) && global.setImmediate(callFns);
        });
    }

    if(global.postMessage) { // modern browsers
        var isPostMessageAsync = true;
        if(global.attachEvent) {
            var checkAsync = function() {
                    isPostMessageAsync = false;
                };
            global.attachEvent('onmessage', checkAsync);
            global.postMessage('__checkAsync', '*');
            global.detachEvent('onmessage', checkAsync);
        }

        if(isPostMessageAsync) {
            var msg = '__nextTick' + (+new Date),
                onMessage = function(e) {
                    if(e.data === msg) {
                        e.stopPropagation && e.stopPropagation();
                        callFns();
                    }
                };

            global.addEventListener?
                global.addEventListener('message', onMessage, true) :
                global.attachEvent('onmessage', onMessage);

            return provide(function(fn) {
                enqueueFn(fn) && global.postMessage(msg, '*');
            });
        }
    }

    var doc = global.document;
    if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
        var head = doc.getElementsByTagName('head')[0],
            createScript = function() {
                var script = doc.createElement('script');
                script.onreadystatechange = function() {
                    script.parentNode.removeChild(script);
                    script = script.onreadystatechange = null;
                    callFns();
                };
                head.appendChild(script);
            };

        return provide(function(fn) {
            enqueueFn(fn) && createScript();
        });
    }

    provide(function(fn) { // old browsers
        enqueueFn(fn) && global.setTimeout(callFns, 0);
    });
});

/* ../../libs/bem-core/common.blocks/next-tick/next-tick.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/objects/objects.vanilla.js begin */
/**
 * @module objects
 * @description A set of helpers to work with JavaScript objects
 */

modules.define('objects', function(provide) {

var hasOwnProp = Object.prototype.hasOwnProperty;

provide(/** @exports */{
    /**
     * Extends a given target by
     * @param {Object} target object to extend
     * @param {...Object} source
     * @returns {Object}
     */
    extend : function(target, source) {
        typeof target !== 'object' && (target = {});

        for(var i = 1, len = arguments.length; i < len; i++) {
            var obj = arguments[i];
            if(obj) {
                for(var key in obj) {
                    hasOwnProp.call(obj, key) && (target[key] = obj[key]);
                }
            }
        }

        return target;
    },

    /**
     * Check whether a given object is empty (contains no enumerable properties)
     * @param {Object} obj
     * @returns {Boolean}
     */
    isEmpty : function(obj) {
        for(var key in obj) {
            if(hasOwnProp.call(obj, key)) {
                return false;
            }
        }

        return true;
    },

    /**
     * Generic iterator function over object
     * @param {Object} obj object to iterate
     * @param {Function} fn callback
     * @param {Object} [ctx] callbacks's context
     */
    each : function(obj, fn, ctx) {
        for(var key in obj) {
            if(hasOwnProp.call(obj, key)) {
                ctx? fn.call(ctx, obj[key], key) : fn(obj[key], key);
            }
        }
    }
});

});

/* ../../libs/bem-core/common.blocks/objects/objects.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/functions/functions.vanilla.js begin */
/**
 * @module functions
 * @description A set of helpers to work with JavaScript functions
 */

modules.define('functions', function(provide) {

var toStr = Object.prototype.toString;

provide(/** @exports */{
    /**
     * Checks whether a given object is function
     * @param {*} obj
     * @returns {Boolean}
     */
    isFunction : function(obj) {
        return toStr.call(obj) === '[object Function]';
    },

    /**
     * Empty function
     */
    noop : function() {}
});

});

/* ../../libs/bem-core/common.blocks/functions/functions.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/events/events.vanilla.js begin */
/**
 * @module events
 */

modules.define(
    'events',
    ['identify', 'inherit', 'functions'],
    function(provide, identify, inherit, functions) {

var undef,
    storageExpando = '__' + (+new Date) + 'storage',
    getFnId = function(fn, ctx) {
        return identify(fn) + (ctx? identify(ctx) : '');
    },

    /**
     * @class Event
     * @exports events:Event
     */
    Event = inherit(/** @lends Event.prototype */{
        /**
         * @constructor
         * @param {String} type
         * @param {Object} target
         */
        __constructor : function(type, target) {
            /**
             * Type
             * @member {String} Event
             */
            this.type = type;

            /**
             * Target
             * @member {String} Event
             */
            this.target = target;

            /**
             * Result
             * @member {*}
             */
            this.result = undef;

            /**
             * Data
             * @member {*}
             */
            this.data = undef;

            this._isDefaultPrevented = false;
            this._isPropagationStopped = false;
        },

        /**
         * Prevents default action
         */
        preventDefault : function() {
            this._isDefaultPrevented = true;
        },

        /**
         * Returns whether is default action prevented
         * @returns {Boolean}
         */
        isDefaultPrevented : function() {
            return this._isDefaultPrevented;
        },

        /**
         * Stops propagation
         */
        stopPropagation : function() {
            this._isPropagationStopped = true;
        },

        /**
         * Returns whether is propagation stopped
         * @returns {Boolean}
         */
        isPropagationStopped : function() {
            return this._isPropagationStopped;
        }
    }),

    /**
     * @lends Emitter
     * @lends Emitter.prototype
     */
    EmitterProps = {
        /**
         * Adds an event handler
         * @param {String} e Event type
         * @param {Object} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @param {Object} [ctx] Handler context
         * @returns {this}
         */
        on : function(e, data, fn, ctx, _special) {
            if(typeof e === 'string') {
                if(functions.isFunction(data)) {
                    ctx = fn;
                    fn = data;
                    data = undef;
                }

                var id = getFnId(fn, ctx),
                    storage = this[storageExpando] || (this[storageExpando] = {}),
                    eventTypes = e.split(' '), eventType,
                    i = 0, list, item,
                    eventStorage;

                while(eventType = eventTypes[i++]) {
                    eventStorage = storage[eventType] || (storage[eventType] = { ids : {}, list : {} });
                    if(!(id in eventStorage.ids)) {
                        list = eventStorage.list;
                        item = { fn : fn, data : data, ctx : ctx, special : _special };
                        if(list.last) {
                            list.last.next = item;
                            item.prev = list.last;
                        } else {
                            list.first = item;
                        }
                        eventStorage.ids[id] = list.last = item;
                    }
                }
            } else {
                for(var key in e) {
                    e.hasOwnProperty(key) && this.on(key, e[key], data, _special);
                }
            }

            return this;
        },

        /**
         * Adds a one time handler for the event.
         * Handler is executed only the next time the event is fired, after which it is removed.
         * @param {String} e Event type
         * @param {Object} [data] Additional data that the handler gets as e.data
         * @param {Function} fn Handler
         * @param {Object} [ctx] Handler context
         * @returns {this}
         */
        once : function(e, data, fn, ctx) {
            return this.on(e, data, fn, ctx, { once : true });
        },

        /**
         * Removes event handler or handlers
         * @param {String} [e] Event type
         * @param {Function} [fn] Handler
         * @param {Object} [ctx] Handler context
         * @returns {this}
         */
        un : function(e, fn, ctx) {
            if(typeof e === 'string' || typeof e === 'undefined') {
                var storage = this[storageExpando];
                if(storage) {
                    if(e) { // if event type was passed
                        var eventTypes = e.split(' '),
                            i = 0, eventStorage;
                        while(e = eventTypes[i++]) {
                            if(eventStorage = storage[e]) {
                                if(fn) {  // if specific handler was passed
                                    var id = getFnId(fn, ctx),
                                        ids = eventStorage.ids;
                                    if(id in ids) {
                                        var list = eventStorage.list,
                                            item = ids[id],
                                            prev = item.prev,
                                            next = item.next;

                                        if(prev) {
                                            prev.next = next;
                                        } else if(item === list.first) {
                                            list.first = next;
                                        }

                                        if(next) {
                                            next.prev = prev;
                                        } else if(item === list.last) {
                                            list.last = prev;
                                        }

                                        delete ids[id];
                                    }
                                } else {
                                    delete this[storageExpando][e];
                                }
                            }
                        }
                    } else {
                        delete this[storageExpando];
                    }
                }
            } else {
                for(var key in e) {
                    e.hasOwnProperty(key) && this.un(key, e[key], fn);
                }
            }

            return this;
        },

        /**
         * Fires event handlers
         * @param {String|events:Event} e Event
         * @param {Object} [data] Additional data
         * @returns {this}
         */
        emit : function(e, data) {
            var storage = this[storageExpando],
                eventInstantiated = false;

            if(storage) {
                var eventTypes = [typeof e === 'string'? e : e.type, '*'],
                    i = 0, eventType, eventStorage;
                while(eventType = eventTypes[i++]) {
                    if(eventStorage = storage[eventType]) {
                        var item = eventStorage.list.first,
                            lastItem = eventStorage.list.last,
                            res;
                        while(item) {
                            if(!eventInstantiated) { // instantiate Event only on demand
                                eventInstantiated = true;
                                typeof e === 'string' && (e = new Event(e));
                                e.target || (e.target = this);
                            }

                            e.data = item.data;
                            res = item.fn.apply(item.ctx || this, arguments);
                            if(typeof res !== 'undefined') {
                                e.result = res;
                                if(res === false) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }

                            item.special && item.special.once &&
                                this.un(e.type, item.fn, item.ctx);

                            if(item === lastItem) {
                                break;
                            }

                            item = item.next;
                        }
                    }
                }
            }

            return this;
        }
    },
    /**
     * @class Emitter
     * @exports events:Emitter
     */
    Emitter = inherit(
        EmitterProps,
        EmitterProps);

provide({
    Emitter : Emitter,
    Event : Event
});

});

/* ../../libs/bem-core/common.blocks/events/events.vanilla.js end */
;
/* ../../libs/bem-core/common.blocks/i-bem/__dom/i-bem__dom.js begin */
/**
 * @module i-bem__dom
 */

modules.define(
    'i-bem__dom',
    ['i-bem', 'i-bem__internal', 'identify', 'objects', 'functions', 'jquery', 'dom'],
    function(provide, BEM, INTERNAL, identify, objects, functions, $, dom) {

var undef,
    win = $(window),
    doc = $(document),

    /**
     * Storage for DOM elements by unique key
     * @type Object
     */
    uniqIdToDomElems = {},

    /**
     * Storage for blocks by unique key
     * @type Object
     */
    uniqIdToBlock = {},

    /**
     * Storage for block parameters
     * @type Object
     */
    domElemToParams = {},

    /**
     * Storage for liveCtx event handlers
     * @type Object
     */
    liveEventCtxStorage = {},

    /**
     * Storage for liveClass event handlers
     * @type Object
     */
    liveClassEventStorage = {},

    blocks = BEM.blocks,

    BEM_CLASS = 'i-bem',
    BEM_SELECTOR = '.' + BEM_CLASS,
    BEM_PARAMS_ATTR = 'data-bem',

    NAME_PATTERN = INTERNAL.NAME_PATTERN,

    MOD_DELIM = INTERNAL.MOD_DELIM,
    ELEM_DELIM = INTERNAL.ELEM_DELIM,

    EXTRACT_MODS_RE = RegExp(
        '[^' + MOD_DELIM + ']' + MOD_DELIM + '(' + NAME_PATTERN + ')' +
        '(?:' + MOD_DELIM + '(' + NAME_PATTERN + '))?$'),

    buildModPostfix = INTERNAL.buildModPostfix,
    buildClass = INTERNAL.buildClass;

/**
 * Initializes blocks on a DOM element
 * @param {jQuery} domElem DOM element
 * @param {String} uniqInitId ID of the "initialization wave"
 */
function init(domElem, uniqInitId) {
    var domNode = domElem[0],
        params = getParams(domNode),
        blockName, blockParams;

    for(blockName in params) {
        if(params.hasOwnProperty(blockName)) {
            blockParams = params[blockName];
            processParams(blockParams, domNode, blockName, uniqInitId);
            var block = uniqIdToBlock[blockParams.uniqId];
            if(block) {
                if(block.domElem.index(domNode) < 0) {
                    block.domElem = block.domElem.add(domElem);
                    objects.extend(block.params, blockParams);
                }
            } else {
                initBlock(blockName, domElem, blockParams);
            }
        }
    }
}

/**
 * Initializes a specific block on a DOM element, or returns the existing block if it was already created
 * @param {String} blockName Block name
 * @param {jQuery} domElem DOM element
 * @param {Object} [params] Initialization parameters
 * @param {Boolean} [forceLive] Force live initialization
 * @param {Function} [callback] Handler to call after complete initialization
 */
function initBlock(blockName, domElem, params, forceLive, callback) {
    if(typeof params === 'boolean') {
        callback = forceLive;
        forceLive = params;
        params = undef;
    }

    var domNode = domElem[0];
    params = processParams(params || getParams(domNode)[blockName], domNode, blockName);

    var uniqId = params.uniqId;
    if(uniqIdToBlock[uniqId]) {
        return uniqIdToBlock[uniqId]._init();
    }

    uniqIdToDomElems[uniqId] = uniqIdToDomElems[uniqId]?
        uniqIdToDomElems[uniqId].add(domElem) :
        domElem;

    var parentDomNode = domNode.parentNode;
    if(!parentDomNode || parentDomNode.nodeType === 11) { // jquery doesn't unique disconnected node
        $.unique(uniqIdToDomElems[uniqId]);
    }

    var blockClass = blocks[blockName] || DOM.decl(blockName, {}, { live : true }, true);
    if(!(blockClass._liveInitable = !!blockClass._processLive()) || forceLive || params.live === false) {
        forceLive && domElem.addClass(BEM_CLASS); // add css class for preventing memory leaks in further destructing

        var block = new blockClass(uniqIdToDomElems[uniqId], params, !!forceLive);
        delete uniqIdToDomElems[uniqId];
        callback && callback.apply(block, Array.prototype.slice.call(arguments, 4));
        return block;
    }
}

/**
 * Processes and adds necessary block parameters
 * @param {Object} params Initialization parameters
 * @param {HTMLElement} domNode DOM node
 * @param {String} blockName Block name
 * @param {String} [uniqInitId] ID of the "initialization wave"
 */
function processParams(params, domNode, blockName, uniqInitId) {
    (params || (params = {})).uniqId ||
        (params.uniqId = (params.id? blockName + '-id-' + params.id : identify()) + (uniqInitId || identify()));

    var domUniqId = identify(domNode),
        domParams = domElemToParams[domUniqId] || (domElemToParams[domUniqId] = {});

    domParams[blockName] || (domParams[blockName] = params);

    return params;
}

/**
 * Helper for searching for a DOM element using a selector inside the context, including the context itself
 * @param {jQuery} ctx Context
 * @param {String} selector CSS selector
 * @param {Boolean} [excludeSelf=false] Exclude context from search
 * @returns {jQuery}
 */
function findDomElem(ctx, selector, excludeSelf) {
    var res = ctx.find(selector);
    return excludeSelf?
       res :
       res.add(ctx.filter(selector));
}

/**
 * Returns parameters of a block's DOM element
 * @param {HTMLElement} domNode DOM node
 * @returns {Object}
 */
function getParams(domNode) {
    var uniqId = identify(domNode);
    return domElemToParams[uniqId] ||
       (domElemToParams[uniqId] = extractParams(domNode));
}

/**
 * Retrieves block parameters from a DOM element
 * @param {HTMLElement} domNode DOM node
 * @returns {Object}
 */
function extractParams(domNode) {
    var attrVal = domNode.getAttribute(BEM_PARAMS_ATTR);
    return attrVal? JSON.parse(attrVal) : {};
}

/**
 * Uncouple DOM node from the block. If this is the last node, then destroys the block.
 * @param {BEMDOM} block block
 * @param {HTMLElement} domNode DOM node
 */
function removeDomNodeFromBlock(block, domNode) {
    block.domElem.length === 1?
        block._destruct(true) :
        block.domElem = block.domElem.not(domNode);
}

/**
 * @class BEMDOM
 * @description Base block for creating BEM blocks that have DOM representation
 * @exports
 */

var DOM = BEM.decl('i-bem__dom',/** @lends BEMDOM.prototype */{
    /**
     * @constructor
     * @private
     * @param {jQuery} domElem DOM element that the block is created on
     * @param {Object} params Block parameters
     * @param {Boolean} [initImmediately=true]
     */
    __constructor : function(domElem, params, initImmediately) {
        /**
         * DOM elements of block
         * @member {jQuery}
         * @readonly
         */
        this.domElem = domElem;

        /**
         * Cache for names of events on DOM elements
         * @member {Object}
         * @private
         */
        this._eventNameCache = {};

        /**
         * Cache for elements
         * @member {Object}
         * @private
         */
        this._elemCache = {};

        uniqIdToBlock[
            /**
             * @member {String} Unique block ID
             * @private
             */
            this._uniqId = params.uniqId || identify(this)] = this;

        /**
         * @member {Boolean} Flag for whether it's necessary to unbind from the document and window when destroying the block
         * @private
         */
        this._needSpecialUnbind = false;

        this.__base(null, params, initImmediately);
    },

    /**
     * Finds blocks inside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM[]}
     */
    findBlocksInside : function(elem, block) {
        return this._findBlocks('find', elem, block);
    },

    /**
     * Finds the first block inside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM}
     */
    findBlockInside : function(elem, block) {
        return this._findBlocks('find', elem, block, true);
    },

    /**
     * Finds blocks outside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM[]}
     */
    findBlocksOutside : function(elem, block) {
        return this._findBlocks('parents', elem, block);
    },

    /**
     * Finds the first block outside the current block or its elements (including context)
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM}
     */
    findBlockOutside : function(elem, block) {
        return this._findBlocks('closest', elem, block)[0] || null;
    },

    /**
     * Finds blocks on DOM elements of the current block or its elements
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM[]}
     */
    findBlocksOn : function(elem, block) {
        return this._findBlocks('', elem, block);
    },

    /**
     * Finds the first block on DOM elements of the current block or its elements
     * @param {String|jQuery} [elem] Block element
     * @param {String|Object} block Name or description (block,modName,modVal) of the block to find
     * @returns {BEMDOM}
     */
    findBlockOn : function(elem, block) {
        return this._findBlocks('', elem, block, true);
    },

    _findBlocks : function(select, elem, block, onlyFirst) {
        if(!block) {
            block = elem;
            elem = undef;
        }

        var ctxElem = elem?
                (typeof elem === 'string'? this.findElem(elem) : elem) :
                this.domElem,
            isSimpleBlock = typeof block === 'string',
            blockName = isSimpleBlock? block : (block.block || block.blockName),
            selector = '.' +
                (isSimpleBlock?
                    buildClass(blockName) :
                    buildClass(blockName, block.modName, block.modVal)) +
                (onlyFirst? ':first' : ''),
            domElems = ctxElem.filter(selector);

        select && (domElems = domElems.add(ctxElem[select](selector)));

        if(onlyFirst) {
            return domElems[0]? initBlock(blockName, domElems.eq(0), true) : null;
        }

        var res = [],
            uniqIds = {};

        domElems.each(function(i, domElem) {
            var block = initBlock(blockName, $(domElem), true);
            if(!uniqIds[block._uniqId]) {
                uniqIds[block._uniqId] = true;
                res.push(block);
            }
        });

        return res;
    },

    /**
     * Adds an event handler for any DOM element
     * @protected
     * @param {jQuery} domElem DOM element where the event will be listened for
     * @param {String|Object} event Event name or event object
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {this}
     */
    bindToDomElem : function(domElem, event, fn) {
        fn?
            domElem.bind(
                this._buildEventName(event),
                $.proxy(fn, this)) :
            objects.each(event, function(fn, event) {
                this.bindToDomElem(domElem, event, fn);
            }, this);

        return this;
    },

    /**
     * Adds an event handler to the document
     * @protected
     * @param {String} event Event name
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {this}
     */
    bindToDoc : function(event, fn) {
        this._needSpecialUnbind = true;
        return this.bindToDomElem(doc, event, fn);
    },

    /**
     * Adds an event handler to the window
     * @protected
     * @param {String} event Event name
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {this}
     */
    bindToWin : function(event, fn) {
        this._needSpecialUnbind = true;
        return this.bindToDomElem(win, event, fn);
    },

    /**
     * Adds an event handler to the block's main DOM elements or its nested elements
     * @protected
     * @param {jQuery|String} [elem] Element
     * @param {String} event Event name
     * @param {Function} fn Handler function, which will be executed in the block's context
     * @returns {this}
     */
    bindTo : function(elem, event, fn) {
        if(!event || functions.isFunction(event)) { // if there is no element
            fn = event;
            event = elem;
            elem = this.domElem;
        } else if(typeof elem === 'string') {
            elem = this.elem(elem);
        }

        return this.bindToDomElem(elem, event, fn);
    },

    /**
     * Removes event handlers from any DOM element
     * @protected
     * @param {jQuery} domElem DOM element where the event was being listened for
     * @param {String} event Event name
     * @param {Function} [fn] Handler function
     * @returns {this}
     */
    unbindFromDomElem : function(domElem, event, fn) {
        event = this._buildEventName(event);

        fn?
            domElem.unbind(event, fn) :
            domElem.unbind(event);
        return this;
    },

    /**
     * Removes event handler from document
     * @protected
     * @param {String} event Event name
     * @param {Function} [fn] Handler function
     * @returns {this}
     */
    unbindFromDoc : function(event, fn) {
        return this.unbindFromDomElem(doc, event, fn);
    },

    /**
     * Removes event handler from window
     * @protected
     * @param {String} event Event name
     * @param {Function} [fn] Handler function
     * @returns {this}
     */
    unbindFromWin : function(event, fn) {
        return this.unbindFromDomElem(win, event, fn);
    },

    /**
     * Removes event handlers from the block's main DOM elements or its nested elements
     * @protected
     * @param {jQuery|String} [elem] Nested element
     * @param {String} event Event name
     * @param {Function} [fn] Handler function
     * @returns {this}
     */
    unbindFrom : function(elem, event, fn) {
        var argLen = arguments.length;
        if(argLen === 1) {
            event = elem;
            elem = this.domElem;
        } else if(argLen === 2 && functions.isFunction(event)) {
            fn = event;
            event = elem;
            elem = this.domElem;
        } else if(typeof elem === 'string') {
            elem = this.elem(elem);
        }

        return this.unbindFromDomElem(elem, event, fn);
    },

    /**
     * Builds a full name for an event
     * @private
     * @param {String} event Event name
     * @returns {String}
     */
    _buildEventName : function(event) {
        return event.indexOf(' ') > 1?
            event.split(' ').map(function(e) {
                return this._buildOneEventName(e);
            }, this).join(' ') :
            this._buildOneEventName(event);
    },

    /**
     * Builds a full name for a single event
     * @private
     * @param {String} event Event name
     * @returns {String}
     */
    _buildOneEventName : function(event) {
        var eventNameCache = this._eventNameCache;

        if(event in eventNameCache) return eventNameCache[event];

        var uniq = '.' + this._uniqId;

        if(event.indexOf('.') < 0) return eventNameCache[event] = event + uniq;

        var lego = '.bem_' + this.__self._name;

        return eventNameCache[event] = event.split('.').map(function(e, i) {
            return i === 0? e + lego : lego + '_' + e;
        }).join('') + uniq;
    },

    _ctxEmit : function(e, data) {
        this.__base.apply(this, arguments);

        var _this = this,
            storage = liveEventCtxStorage[_this.__self._buildCtxEventName(e.type)],
            ctxIds = {};

        storage && _this.domElem.each(function() {
            var ctx = this,
                counter = storage.counter;
            while(ctx && counter) {
                var ctxId = identify(ctx, true);
                if(ctxId) {
                    if(ctxIds[ctxId]) break;
                    var storageCtx = storage.ctxs[ctxId];
                    if(storageCtx) {
                        objects.each(storageCtx, function(handler) {
                            handler.fn.call(
                                handler.ctx || _this,
                                e,
                                data);
                        });
                        counter--;
                    }
                    ctxIds[ctxId] = true;
                }
                ctx = ctx.parentNode;
            }
        });
    },

    /**
     * Sets a modifier for a block/nested element
     * @param {jQuery} [elem] Nested element
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @returns {this}
     */
    setMod : function(elem, modName, modVal) {
        if(elem && typeof modVal !== 'undefined' && elem.length > 1) {
            var _this = this;
            elem.each(function() {
                var item = $(this);
                item.__bemElemName = elem.__bemElemName;
                _this.setMod(item, modName, modVal);
            });
            return _this;
        }
        return this.__base(elem, modName, modVal);
    },

    /**
     * Retrieves modifier value from the DOM node's CSS class
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery} [elem] Nested element
     * @param {String} [elemName] Name of the nested element
     * @returns {String} Modifier value
     */
    _extractModVal : function(modName, elem, elemName) {
        var domNode = (elem || this.domElem)[0],
            matches;

        domNode &&
            (matches = domNode.className
                .match(this.__self._buildModValRE(modName, elemName || elem)));

        return matches? matches[2] || true : '';
    },

    /**
     * Retrieves a name/value list of modifiers
     * @private
     * @param {Array} [modNames] Names of modifiers
     * @param {Object} [elem] Element
     * @returns {Object} Hash of modifier values by names
     */
    _extractMods : function(modNames, elem) {
        var res = {},
            extractAll = !modNames.length,
            countMatched = 0;

        ((elem || this.domElem)[0].className
            .match(this.__self._buildModValRE(
                '(' + (extractAll? NAME_PATTERN : modNames.join('|')) + ')',
                elem,
                'g')) || []).forEach(function(className) {
                    var matches = className.match(EXTRACT_MODS_RE);
                    res[matches[1]] = matches[2] || true;
                    ++countMatched;
                });

        // empty modifier values are not reflected in classes; they must be filled with empty values
        countMatched < modNames.length && modNames.forEach(function(modName) {
            modName in res || (res[modName] = '');
        });

        return res;
    },

    /**
     * Sets a modifier's CSS class for a block's DOM element or nested element
     * @private
     * @param {String} modName Modifier name
     * @param {String} modVal Modifier value
     * @param {String} oldModVal Old modifier value
     * @param {jQuery} [elem] Element
     * @param {String} [elemName] Element name
     */
    _onSetMod : function(modName, modVal, oldModVal, elem, elemName) {
        if(modName !== 'js' || modVal !== '') {
            var _self = this.__self,
                classPrefix = _self._buildModClassPrefix(modName, elemName),
                classRE = _self._buildModValRE(modName, elemName),
                needDel = modVal === '' || modVal === false;

            (elem || this.domElem).each(function() {
                var className = this.className,
                    modClassName = classPrefix;

                modVal !== true && (modClassName += MOD_DELIM + modVal);

                (oldModVal === true?
                    classRE.test(className) :
                    className.indexOf(classPrefix + MOD_DELIM) > -1)?
                        this.className = className.replace(
                            classRE,
                            (needDel? '' : '$1' + modClassName)) :
                        needDel || $(this).addClass(modClassName);
            });

            elemName && this
                .dropElemCache(elemName, modName, oldModVal)
                .dropElemCache(elemName, modName, modVal);
        }

        this.__base.apply(this, arguments);
    },

    /**
     * Finds elements nested in a block
     * @param {jQuery} [ctx=this.domElem] Element where search is being performed
     * @param {String} names Nested element name (or names separated by spaces)
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @param {Boolean} [strictMode=false]
     * @returns {jQuery} DOM elements
     */
    findElem : function(ctx, names, modName, modVal, strictMode) {
        if(typeof ctx === 'string') {
            strictMode = modVal;
            modVal = modName;
            modName = names;
            names = ctx;
            ctx = this.domElem;
        }

        if(typeof modName === 'boolean') {
            strictMode = modName;
            modName = undef;
        }

        var _self = this.__self,
            selector = '.' +
                names.split(' ').map(function(name) {
                    return _self.buildClass(name, modName, modVal);
                }).join(',.'),
            res = findDomElem(ctx, selector);

        return strictMode? this._filterFindElemResults(res) : res;
    },

    /**
     * Filters results of findElem helper execution in strict mode
     * @param {jQuery} res DOM elements
     * @returns {jQuery} DOM elements
     */
    _filterFindElemResults : function(res) {
        var blockSelector = this.buildSelector(),
            domElem = this.domElem;
        return res.filter(function() {
            return domElem.index($(this).closest(blockSelector)) > -1;
        });
    },

    /**
     * Finds elements nested in a block
     * @private
     * @param {String} name Nested element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {jQuery} DOM elements
     */
    _elem : function(name, modName, modVal) {
        var key = name + buildModPostfix(modName, modVal),
            res;

        if(!(res = this._elemCache[key])) {
            res = this._elemCache[key] = this.findElem(name, modName, modVal);
            res.__bemElemName = name;
        }

        return res;
    },

    /**
     * Lazy search for elements nested in a block (caches results)
     * @param {String} names Nested element name (or names separated by spaces)
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {jQuery} DOM elements
     */
    elem : function(names, modName, modVal) {
        if(modName && typeof modName !== 'string') {
            modName.__bemElemName = names;
            return modName;
        }

        if(names.indexOf(' ') < 0) {
            return this._elem(names, modName, modVal);
        }

        var res = $([]);
        names.split(' ').forEach(function(name) {
            res = res.add(this._elem(name, modName, modVal));
        }, this);
        return res;
    },

    /**
     * Finds elements outside the context
     * @param {jQuery} ctx context
     * @param {String} elemName Element name
     * @returns {jQuery} DOM elements
     */
    closestElem : function(ctx, elemName) {
        return ctx.closest(this.buildSelector(elemName));
    },

    /**
     * Clearing the cache for elements
     * @protected
     * @param {String} [names] Nested element name (or names separated by spaces)
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {this}
     */
    dropElemCache : function(names, modName, modVal) {
        if(names) {
            var modPostfix = buildModPostfix(modName, modVal);
            names.indexOf(' ') < 0?
                delete this._elemCache[names + modPostfix] :
                names.split(' ').forEach(function(name) {
                    delete this._elemCache[name + modPostfix];
                }, this);
        } else {
            this._elemCache = {};
        }

        return this;
    },

    /**
     * Retrieves parameters of a block element
     * @param {String|jQuery} elem Element
     * @returns {Object} Parameters
     */
    elemParams : function(elem) {
        var elemName;
        if(typeof elem === 'string') {
            elemName = elem;
            elem = this.elem(elem);
        } else {
            elemName = this.__self._extractElemNameFrom(elem);
        }

        return extractParams(elem[0])[this.__self.buildClass(elemName)] || {};
    },

    /**
     * Elemify given element
     * @param {jQuery} elem Element
     * @param {String} elemName Name
     * @returns {jQuery}
     */
    elemify : function(elem, elemName) {
        (elem = $(elem)).__bemElemName = elemName;
        return elem;
    },

    /**
     * Checks whether a DOM element is in a block
     * @protected
     * @param {jQuery} [ctx=this.domElem] Element where check is being performed
     * @param {jQuery} domElem DOM element
     * @returns {Boolean}
     */
    containsDomElem : function(ctx, domElem) {
        if(arguments.length === 1) {
            domElem = ctx;
            ctx = this.domElem;
        }

        return dom.contains(ctx, domElem);
    },

    /**
     * Builds a CSS selector corresponding to a block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildSelector : function(elem, modName, modVal) {
        return this.__self.buildSelector(elem, modName, modVal);
    },

    /**
     * Destructs a block
     * @private
     */
    _destruct : function() {
        var _this = this,
            _self = _this.__self;

        _this._needSpecialUnbind && _self.doc.add(_self.win).unbind('.' + _this._uniqId);

        _this.__base();

        delete uniqIdToBlock[_this.un()._uniqId];
    }

}, /** @lends BEMDOM */{

    /**
     * Scope, will be set on onDomReady to `<body>`
     * @type jQuery
     */
    scope : null,

    /**
     * Document shortcut
     * @type jQuery
     */
    doc : doc,

    /**
     * Window shortcut
     * @type jQuery
     */
    win : win,

    /**
     * Processes a block's live properties
     * @private
     * @param {Boolean} [heedLive=false] Whether to take into account that the block already processed its live properties
     * @returns {Boolean} Whether the block is a live block
     */
    _processLive : function(heedLive) {
        var res = this._liveInitable;

        if('live' in this) {
            var noLive = typeof res === 'undefined';

            if(noLive ^ heedLive) {
                res = this.live() !== false;
                this.live = functions.noop;
            }
        }

        return res;
    },

    /**
     * Initializes blocks on a fragment of the DOM tree
     * @param {jQuery|String} [ctx=scope] Root DOM node
     * @returns {jQuery} ctx Initialization context
     */
    init : function(ctx) {
        if(typeof ctx === 'string') ctx = $(ctx);
        else if(!ctx) ctx = DOM.scope;

        var uniqInitId = identify();
        findDomElem(ctx, BEM_SELECTOR).each(function() {
            init($(this), uniqInitId);
        });

        this._runInitFns();

        return ctx;
    },

    /**
     * Destroys blocks on a fragment of the DOM tree
     * @param {jQuery} ctx Root DOM node
     * @param {Boolean} [excludeSelf=false] Exclude the main domElem
     */
    destruct : function(ctx, excludeSelf) {
        findDomElem(ctx, BEM_SELECTOR, excludeSelf).each(function(i, domNode) {
            var params = getParams(domNode);
            objects.each(params, function(blockParams) {
                if(blockParams.uniqId) {
                    var block = uniqIdToBlock[blockParams.uniqId];
                    block?
                        removeDomNodeFromBlock(block, domNode) :
                        delete uniqIdToDomElems[blockParams.uniqId];
                }
            });
            delete domElemToParams[identify(domNode)];
        });

        excludeSelf? ctx.empty() : ctx.remove();
    },

    /**
     * Replaces a fragment of the DOM tree inside the context, destroying old blocks and intializing new ones
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content New content
     * @returns {jQuery} Updated root DOM node
     */
    update : function(ctx, content) {
        this.destruct(ctx, true);
        return this.init(ctx.html(content));
    },

    /**
     * Changes a fragment of the DOM tree including the context and initializes blocks.
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    replace : function(ctx, content) {
        var prev = ctx.prev(),
            parent = ctx.parent();

        this.destruct(ctx);

        return this.init(prev.length?
            $(content).insertAfter(prev) :
            $(content).prependTo(parent));
    },

    /**
     * Adds a fragment of the DOM tree at the end of the context and initializes blocks
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    append : function(ctx, content) {
        return this.init($(content).appendTo(ctx));
    },

    /**
     * Adds a fragment of the DOM tree at the beginning of the context and initializes blocks
     * @param {jQuery} ctx Root DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    prepend : function(ctx, content) {
        return this.init($(content).prependTo(ctx));
    },

    /**
     * Adds a fragment of the DOM tree before the context and initializes blocks
     * @param {jQuery} ctx Contextual DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    before : function(ctx, content) {
        return this.init($(content).insertBefore(ctx));
    },

    /**
     * Adds a fragment of the DOM tree after the context and initializes blocks
     * @param {jQuery} ctx Contextual DOM node
     * @param {jQuery|String} content Content to be added
     * @returns {jQuery} New content
     */
    after : function(ctx, content) {
        return this.init($(content).insertAfter(ctx));
    },

    /**
     * Builds a full name for a live event
     * @private
     * @param {String} e Event name
     * @returns {String}
     */
    _buildCtxEventName : function(e) {
        return this._name + ':' + e;
    },

    _liveClassBind : function(className, e, callback, invokeOnInit) {
        if(e.indexOf(' ') > -1) {
            e.split(' ').forEach(function(e) {
                this._liveClassBind(className, e, callback, invokeOnInit);
            }, this);
        } else {
            var storage = liveClassEventStorage[e],
                uniqId = identify(callback);

            if(!storage) {
                storage = liveClassEventStorage[e] = {};
                DOM.scope.bind(e, $.proxy(this._liveClassTrigger, this));
            }

            storage = storage[className] || (storage[className] = { uniqIds : {}, fns : [] });

            if(!(uniqId in storage.uniqIds)) {
                storage.fns.push({ uniqId : uniqId, fn : this._buildLiveEventFn(callback, invokeOnInit) });
                storage.uniqIds[uniqId] = storage.fns.length - 1;
            }
        }

        return this;
    },

    _liveClassUnbind : function(className, e, callback) {
        var storage = liveClassEventStorage[e];
        if(storage) {
            if(callback) {
                if(storage = storage[className]) {
                    var uniqId = identify(callback);
                    if(uniqId in storage.uniqIds) {
                        var i = storage.uniqIds[uniqId],
                            len = storage.fns.length - 1;
                        storage.fns.splice(i, 1);
                        while(i < len) storage.uniqIds[storage.fns[i++].uniqId] = i - 1;
                        delete storage.uniqIds[uniqId];
                    }
                }
            } else {
                delete storage[className];
            }
        }

        return this;
    },

    _liveClassTrigger : function(e) {
        var storage = liveClassEventStorage[e.type];
        if(storage) {
            var node = e.target, classNames = [];
            for(var className in storage) {
                storage.hasOwnProperty(className) && classNames.push(className);
            }
            do {
                var nodeClassName = ' ' + node.className + ' ', i = 0;
                while(className = classNames[i++]) {
                    if(nodeClassName.indexOf(' ' + className + ' ') > -1) {
                        var j = 0, fns = storage[className].fns, fn, stopPropagationAndPreventDefault = false;
                        while(fn = fns[j++])
                            if(fn.fn.call($(node), e) === false) stopPropagationAndPreventDefault = true;

                        stopPropagationAndPreventDefault && e.preventDefault();
                        if(stopPropagationAndPreventDefault || e.isPropagationStopped()) return;

                        classNames.splice(--i, 1);
                    }
                }
            } while(classNames.length && (node = node.parentNode));
        }
    },

    _buildLiveEventFn : function(callback, invokeOnInit) {
        var _this = this;
        return function(e) {
            e.currentTarget = this;
            var args = [
                    _this._name,
                    $(this).closest(_this.buildSelector()),
                    true
                ],
                block = initBlock.apply(null, invokeOnInit? args.concat([callback, e]) : args);

            if(block && !invokeOnInit && callback)
                return callback.apply(block, arguments);
        };
    },

    /**
     * Helper for live initialization for an event on DOM elements of a block or its elements
     * @protected
     * @param {String} [elemName] Element name or names (separated by spaces)
     * @param {String} event Event name
     * @param {Function} [callback] Handler to call after successful initialization
     */
    liveInitOnEvent : function(elemName, event, callback) {
        return this.liveBindTo(elemName, event, callback, true);
    },

    /**
     * Helper for subscribing to live events on DOM elements of a block or its elements
     * @protected
     * @param {String|Object} [to] Description (object with modName, modVal, elem) or name of the element or elements (space-separated)
     * @param {String} event Event name
     * @param {Function} [callback] Handler
     */
    liveBindTo : function(to, event, callback, invokeOnInit) {
        if(!event || functions.isFunction(event)) {
            callback = event;
            event = to;
            to = undef;
        }

        if(!to || typeof to === 'string') {
            to = { elem : to };
        }

        if(to.elem && to.elem.indexOf(' ') > 0) {
            to.elem.split(' ').forEach(function(elem) {
                this._liveClassBind(
                    this.buildClass(elem, to.modName, to.modVal),
                    event,
                    callback,
                    invokeOnInit);
            }, this);
            return this;
        }

        return this._liveClassBind(
            this.buildClass(to.elem, to.modName, to.modVal),
            event,
            callback,
            invokeOnInit);
    },

    /**
     * Helper for unsubscribing from live events on DOM elements of a block or its elements
     * @protected
     * @param {String} [elem] Name of the element or elements (space-separated)
     * @param {String} event Event name
     * @param {Function} [callback] Handler
     */
    liveUnbindFrom : function(elem, event, callback) {
        if(elem.indexOf(' ') > 1) {
            elem.split(' ').forEach(function(elem) {
                this._liveClassUnbind(
                    this.buildClass(elem),
                    event,
                    callback);
            }, this);
            return this;
        }

        return this._liveClassUnbind(
            this.buildClass(elem),
            event,
            callback);
    },

    /**
     * Helper for live initialization when a different block is initialized
     * @private
     * @param {String} event Event name
     * @param {String} blockName Name of the block that should trigger a reaction when initialized
     * @param {Function} callback Handler to be called after successful initialization in the new block's context
     * @param {String} findFnName Name of the method for searching
     */
    _liveInitOnBlockEvent : function(event, blockName, callback, findFnName) {
        var name = this._name;
        blocks[blockName].on(event, function(e) {
            var args = arguments,
                blocks = e.target[findFnName](name);

            callback && blocks.forEach(function(block) {
                callback.apply(block, args);
            });
        });
        return this;
    },

    /**
     * Helper for live initialization for a different block's event on the current block's DOM element
     * @protected
     * @param {String} event Event name
     * @param {String} blockName Name of the block that should trigger a reaction when initialized
     * @param {Function} callback Handler to be called after successful initialization in the new block's context
     */
    liveInitOnBlockEvent : function(event, blockName, callback) {
        return this._liveInitOnBlockEvent(event, blockName, callback, 'findBlocksOn');
    },

    /**
     * Helper for live initialization for a different block's event inside the current block
     * @protected
     * @param {String} event Event name
     * @param {String} blockName Name of the block that should trigger a reaction when initialized
     * @param {Function} [callback] Handler to be called after successful initialization in the new block's context
     */
    liveInitOnBlockInsideEvent : function(event, blockName, callback) {
        return this._liveInitOnBlockEvent(event, blockName, callback, 'findBlocksOutside');
    },

    /**
     * Adds a live event handler to a block, based on a specified element where the event will be listened for
     * @param {jQuery} [ctx] The element in which the event will be listened for
     * @param {String} e Event name
     * @param {Object} [data] Additional information that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [fnCtx] Handler's context
     */
    on : function(ctx, e, data, fn, fnCtx) {
        return typeof ctx === 'object' && ctx.jquery?
            this._liveCtxBind(ctx, e, data, fn, fnCtx) :
            this.__base(ctx, e, data, fn);
    },

    /**
     * Removes the live event handler from a block, based on a specified element where the event was being listened for
     * @param {jQuery} [ctx] The element in which the event was being listened for
     * @param {String} e Event name
     * @param {Function} [fn] Handler
     * @param {Object} [fnCtx] Handler context
     */
    un : function(ctx, e, fn, fnCtx) {
        return typeof ctx === 'object' && ctx.jquery?
            this._liveCtxUnbind(ctx, e, fn, fnCtx) :
            this.__base(ctx, e, fn);
    },

    /**
     * Adds a live event handler to a block, based on a specified element where the event will be listened for
     * @private
     * @param {jQuery} ctx The element in which the event will be listened for
     * @param {String} e  Event name
     * @param {Object} [data] Additional information that the handler gets as e.data
     * @param {Function} fn Handler
     * @param {Object} [fnCtx] Handler context
     * @returns {this}
     */
    _liveCtxBind : function(ctx, e, data, fn, fnCtx) {
        if(typeof e === 'object') {
            if(functions.isFunction(data) || functions.isFunction(fn)) { // mod change event
                e = this._buildModEventName(e);
            } else {
                objects.each(e, function(fn, e) {
                    this._liveCtxBind(ctx, e, fn, data);
                }, this);
                return this;
            }
        }

        if(functions.isFunction(data)) {
            fnCtx = fn;
            fn = data;
            data = undef;
        }

        if(e.indexOf(' ') > -1) {
            e.split(' ').forEach(function(e) {
                this._liveCtxBind(ctx, e, data, fn, fnCtx);
            }, this);
        } else {
            var ctxE = this._buildCtxEventName(e),
                storage = liveEventCtxStorage[ctxE] ||
                    (liveEventCtxStorage[ctxE] = { counter : 0, ctxs : {} });

            ctx.each(function() {
                var ctxId = identify(this),
                    ctxStorage = storage.ctxs[ctxId];
                if(!ctxStorage) {
                    ctxStorage = storage.ctxs[ctxId] = {};
                    ++storage.counter;
                }
                ctxStorage[identify(fn) + (fnCtx? identify(fnCtx) : '')] = {
                    fn : fn,
                    data : data,
                    ctx : fnCtx
                };
            });
        }

        return this;
    },

    /**
     * Removes a live event handler from a block, based on a specified element where the event was being listened for
     * @private
     * @param {jQuery} ctx The element in which the event was being listened for
     * @param {String|Object} e Event name
     * @param {Function} [fn] Handler
     * @param {Object} [fnCtx] Handler context
     */
    _liveCtxUnbind : function(ctx, e, fn, fnCtx) {
        if(typeof e === 'object' && functions.isFunction(fn)) { // mod change event
            e = this._buildModEventName(e);
        }

        var storage = liveEventCtxStorage[e = this._buildCtxEventName(e)];

        if(storage) {
            ctx.each(function() {
                var ctxId = identify(this, true),
                    ctxStorage;
                if(ctxId && (ctxStorage = storage.ctxs[ctxId])) {
                    fn && delete ctxStorage[identify(fn) + (fnCtx? identify(fnCtx) : '')];
                    if(!fn || objects.isEmpty(ctxStorage)) {
                        storage.counter--;
                        delete storage.ctxs[ctxId];
                    }
                }
            });
            storage.counter || delete liveEventCtxStorage[e];
        }

        return this;
    },

    /**
     * Retrieves the name of an element nested in a block
     * @private
     * @param {jQuery} elem Nested element
     * @returns {String|undef}
     */
    _extractElemNameFrom : function(elem) {
        if(elem.__bemElemName) return elem.__bemElemName;

        var matches = elem[0].className.match(this._buildElemNameRE());
        return matches? matches[1] : undef;
    },

    /**
     * Builds a prefix for the CSS class of a DOM element or nested element of the block, based on modifier name
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery|String} [elem] Element
     * @returns {String}
     */
    _buildModClassPrefix : function(modName, elem) {
        return this._name +
               (elem?
                   ELEM_DELIM + (typeof elem === 'string'? elem : this._extractElemNameFrom(elem)) :
                   '') +
               MOD_DELIM + modName;
    },

    /**
     * Builds a regular expression for extracting modifier values from a DOM element or nested element of a block
     * @private
     * @param {String} modName Modifier name
     * @param {jQuery|String} [elem] Element
     * @param {String} [quantifiers] Regular expression quantifiers
     * @returns {RegExp}
     */
    _buildModValRE : function(modName, elem, quantifiers) {
        return new RegExp(
            '(\\s|^)' +
            this._buildModClassPrefix(modName, elem) +
            '(?:' + MOD_DELIM + '(' + NAME_PATTERN + '))?(?=\\s|$)',
            quantifiers);
    },

    /**
     * Builds a regular expression for extracting names of elements nested in a block
     * @private
     * @returns {RegExp}
     */
    _buildElemNameRE : function() {
        return new RegExp(this._name + ELEM_DELIM + '(' + NAME_PATTERN + ')(?:\\s|$)');
    },

    /**
     * Builds a CSS class corresponding to the block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildClass : function(elem, modName, modVal) {
        return buildClass(this._name, elem, modName, modVal);
    },

    /**
     * Builds a CSS selector corresponding to the block/element and modifier
     * @param {String} [elem] Element name
     * @param {String} [modName] Modifier name
     * @param {String} [modVal] Modifier value
     * @returns {String}
     */
    buildSelector : function(elem, modName, modVal) {
        return '.' + this.buildClass(elem, modName, modVal);
    }
});

/**
 * Returns a block on a DOM element and initializes it if necessary
 * @param {String} blockName Block name
 * @param {Object} params Block parameters
 * @returns {BEMDOM}
 */
$.fn.bem = function(blockName, params) {
    return initBlock(blockName, this, params, true);
};

// Set default scope after DOM ready
$(function() {
    DOM.scope = $('body');
});

provide(DOM);

});

(function() {

var origDefine = modules.define;

modules.define = function(name, deps, decl) {
    origDefine.apply(modules, arguments);

    name !== 'i-bem__dom_init' && arguments.length > 2 && ~deps.indexOf('i-bem__dom') &&
        modules.define('i-bem__dom_init', [name], function(provide, _, prev) {
            provide(prev);
        });
};

})();

/* ../../libs/bem-core/common.blocks/i-bem/__dom/i-bem__dom.js end */
;
/* ../../libs/bem-core/common.blocks/jquery/jquery.js begin */
/**
 * @module jquery
 * @description Provide jQuery (load if it does not exist).
 */

modules.define(
    'jquery',
    ['loader_type_js', 'jquery__config'],
    function(provide, loader, cfg) {

/* global jQuery */

function doProvide(preserveGlobal) {
    /**
     * @exports
     * @type {Function} jQuery
     */
    provide(preserveGlobal? jQuery : jQuery.noConflict(true));
}

typeof jQuery !== 'undefined'?
    doProvide(true) :
    loader(cfg.url, doProvide);
});

/* ../../libs/bem-core/common.blocks/jquery/jquery.js end */
;
/* ../../libs/bem-core/common.blocks/loader/_type/loader_type_js.js begin */
/**
 * @module loader_type_js
 * @description Load JS from external URL.
 */

modules.define('loader_type_js', function(provide) {

var loading = {},
    loaded = {},
    head = document.getElementsByTagName('head')[0],
    onLoad = function(path) {
        loaded[path] = true;
        var cbs = loading[path], cb, i = 0;
        delete loading[path];
        while(cb = cbs[i++]) {
            cb();
        }
    };

provide(
    /**
     * @exports
     * @param {String} path resource link
     * @param {Function} callback executes when resource is loaded
     */
    function(path, cb) {
        if(loaded[path]) {
            cb();
            return;
        }

        if(loading[path]) {
            loading[path].push(cb);
            return;
        }

        loading[path] = [cb];

        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.charset = 'utf-8';
        script.src = (location.protocol === 'file:' && !path.indexOf('//')? 'http:' : '') + path;
        script.onreadystatechange === null?
            script.onreadystatechange = function() {
                var readyState = this.readyState;
                if(readyState === 'loaded' || readyState === 'complete') {
                    script.onreadystatechange = null;
                    onLoad(path);
                }
            } :
            script.onload = script.onerror = function() {
                script.onload = script.onerror = null;
                onLoad(path);
            };

        head.insertBefore(script, head.lastChild);
    }
);

});

/* ../../libs/bem-core/common.blocks/loader/_type/loader_type_js.js end */
;
/* ../../libs/bem-core/common.blocks/jquery/__config/jquery__config.js begin */
/**
 * @module jquery__config
 * @description Configuration for jQuery
 */

modules.define('jquery__config', function(provide) {

provide(/** @exports */{
    /**
     * URL for loading jQuery if it does not exist
     */
    url : '//yastatic.net/jquery/2.1.0/jquery.min.js'
});

});

/* ../../libs/bem-core/common.blocks/jquery/__config/jquery__config.js end */
;
/* ../../libs/bem-core/desktop.blocks/jquery/__config/jquery__config.js begin */
/**
 * @module jquery__config
 * @description Configuration for jQuery
 */

modules.define(
    'jquery__config',
    ['ua', 'objects'],
    function(provide, ua, objects, base) {

provide(
    ua.msie && parseInt(ua.version, 10) < 9?
        objects.extend(
            base,
            {
                url : '//yastatic.net/jquery/1.11.0/jquery.min.js'
            }) :
        base);

});

/* ../../libs/bem-core/desktop.blocks/jquery/__config/jquery__config.js end */
;
/* ../../libs/bem-core/desktop.blocks/ua/ua.js begin */
/** 
 * @module ua
 * @description Detect some user agent features (works like jQuery.browser in jQuery 1.8)
 * @see http://code.jquery.com/jquery-migrate-1.1.1.js
 */

modules.define('ua', function(provide) {

var ua = navigator.userAgent.toLowerCase(),
    match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+)/.exec(ua) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
        /(msie) ([\w.]+)/.exec(ua) ||
        ua.indexOf('compatible') < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
        [],
    matched = {
        browser : match[1] || '',
        version : match[2] || '0'
    },
    browser = {};

if(matched.browser) {
    browser[matched.browser] = true;
    browser.version = matched.version;
}

if(browser.chrome) {
    browser.webkit = true;
} else if(browser.webkit) {
    browser.safari = true;
}

/**
 * @exports
 * @type Object
 */
provide(browser);

});

/* ../../libs/bem-core/desktop.blocks/ua/ua.js end */
;
/* ../../libs/bem-core/common.blocks/dom/dom.js begin */
/**
 * @module dom
 * @description some DOM utils
 */

modules.define('dom', ['jquery'], function(provide, $) {

provide(/** @exports */{
    /**
     * Checks whether a DOM elem is in a context
     * @param {jQuery} ctx DOM elem where check is being performed
     * @param {jQuery} domElem DOM elem to check
     * @returns {Boolean}
     */
    contains : function(ctx, domElem) {
        var res = false;

        domElem.each(function() {
            var domNode = this;
            do {
                if(~ctx.index(domNode)) return !(res = true);
            } while(domNode = domNode.parentNode);

            return res;
        });

        return res;
    },

    /**
     * Returns current focused DOM elem in document
     * @returns {jQuery}
     */
    getFocused : function() {
        // "Error: Unspecified error." in iframe in IE9
        try { return $(document.activeElement); } catch(e) {}
    },

    /**
     * Checks whether a DOM element contains focus
     * @param {jQuery} domElem
     * @returns {Boolean}
     */
    containsFocus : function(domElem) {
        return this.contains(domElem, this.getFocused());
    },

    /**
    * Checks whether a browser currently can set focus on DOM elem
    * @param {jQuery} domElem
    * @returns {Boolean}
    */
    isFocusable : function(domElem) {
        var domNode = domElem[0];

        if(!domNode) return false;

        switch(domNode.tagName.toLowerCase()) {
            case 'iframe':
                return true;

            case 'input':
            case 'button':
            case 'textarea':
            case 'select':
                return !domNode.disabled;

            case 'a':
                return !!domNode.href;

            default:
                return domNode.hasAttribute('tabindex');
        }
    },

    /**
    * Checks whether a domElem is intended to edit text
    * @param {jQuery} domElem
    * @returns {Boolean}
    */
    isEditable : function(domElem) {
        var domNode = domElem[0];

        if(!domNode) return false;

        switch(domNode.tagName.toLowerCase()) {
            case 'input':
                var type = domNode.type;
                return (type === 'text' || type === 'password') && !domNode.disabled && !domNode.readOnly;

            case 'textarea':
                return !domNode.disabled && !domNode.readOnly;

            default:
                return domNode.contentEditable === 'true';
        }
    }
});

});
/* ../../libs/bem-core/common.blocks/dom/dom.js end */
;
/* ../../libs/bem-core/common.blocks/i-bem/__dom/_init/i-bem__dom_init.js begin */
/**
 * @module i-bem__dom_init
 */

modules.define('i-bem__dom_init', ['i-bem__dom'], function(provide, BEMDOM) {

provide(
    /**
     * Initializes blocks on a fragment of the DOM tree
     * @exports
     * @param {jQuery} [ctx=scope] Root DOM node
     * @returns {jQuery} ctx Initialization context
     */
    function(ctx) {
        return BEMDOM.init(ctx);
    });
});

/* ../../libs/bem-core/common.blocks/i-bem/__dom/_init/i-bem__dom_init.js end */
;
/* blocks/page/page.js begin */
modules.define('page', ['i-bem__dom'], function(provide, BEMDOM) {

var GAME_SIZE = 11;

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                modules.require(['go-game', 'game'], function(GoGame, Game) {
                    BEMDOM.append(
                        this.domElem,
                        GoGame.create(new Game(GAME_SIZE)).domElem);
                }.bind(this));
            }
        }
    }
}));

});

/* blocks/page/page.js end */
;
/* ../../libs/bem-core/common.blocks/i-bem/__dom/_init/i-bem__dom_init_auto.js begin */
/**
 * Auto initialization on DOM ready
 */

modules.require(['i-bem__dom_init', 'jquery'], function(init, $) {

$(function() {
    init();
});

});

/* ../../libs/bem-core/common.blocks/i-bem/__dom/_init/i-bem__dom_init_auto.js end */
;
/* ../../blocks/game/game.js begin */
/** @module game */

modules.define('game', ['inherit'], function(provide, inherit) {

var EMPTY = -1,
    BLACK = 0,
    WHITE = 1;

/**
 * @class Game
 * @exports
 */

provide(inherit( /** @lends Game.prototype */{
    __constructor : function(size) {
        this._lastMovePassed = false;
        this._inAtari = false;
        this._attempedSuicide = false;
        this._gameOver = false;
        this._currentColor = BLACK;
        this._size = size;
        this._board = this._createBoard(size);
        this._score = [0, 0];
    },

    _createBoard : function(size) {
        var board = [];
        for(var col = 0; col < size; col++) {
            board[col] = [];
            for(var row = 0; row < size; row++) {
                board[col][row] = EMPTY;
            }
        }
        return board;
    },

    /**
     * Whether player is in atari state
     * @returns {Boolean}
     */
    isInAtari : function() {
        return this._inAtari;
    },

    /**
     * Whether player attempted to make a suicide turn
     * @returns {Boolean}
     */
    isAttemptedSuicide : function() {
        return this._attempedSuicide;
    },

    /**
     * Whether game is over
     * @returns {Boolean}
     */
    isGameOver : function() {
        return this._gameOver;
    },

    /**
     * Returns size of the game
     * @returns {Number}
     */
    getSize : function() {
        return this._size;
    },

    /**
     * Returns current player color
     * @returns {Number}
     */
    getCurrentColor : function() {
        return this._currentColor;
    },

    /**
     * Returns game state in a given position
     * @param {Number|Array} colOrPos
     * @param {Number} [row]
     * @returns {Number}
     */
    getStateByPos : function(colOrPos, row) {
        var board = this._board;
        return typeof row === 'undefined'?
            board[colOrPos[0]][colOrPos[1]] :
            board[colOrPos][row];
    },

    /**
     * Returns game score
     * @param {Numner} [color]
     * @returns {Array|Number}
     */
    getScore : function(color) {
        return typeof color === 'undefined'? this._score : this._score[color];
    },

    _switchPlayer : function() {
        this._currentColor = this._currentColor === BLACK? WHITE : BLACK;
    },

    _getAdjacentPoints : function(col, row) {
        var points = [],
            size = this._size;

        col > 0 && points.push([col - 1, row]);
        col < size - 1 && points.push([col + 1, row]);

        row > 0 && points.push([col, row - 1]);
        row < size -1 && points.push([col, row + 1]);

        return points;
    },

    _getGroup : function(col, row) {
        var state = this.getStateByPos(col, row);
        if(state === EMPTY)
            return null;

        var visited = {},
            visitedList = [],
            queue = [[col, row]],
            liberties = 0,
            stone;

        while(stone = queue.pop()) {
            if(visited[stone]) continue;

            this._getAdjacentPoints(stone[0], stone[1]).forEach(function(pos) {
                var stateInPos = this.getStateByPos(pos);
                if(stateInPos === EMPTY) {
                    liberties++;
                    return;
                }

                stateInPos === state && queue.push([pos[0], pos[1]]);
            }, this);

            visited[stone] = true;
            visitedList.push(stone);
        }

        return {
            liberties : liberties,
            stones : visitedList
        };
    },

    /**
     * Pass current's player turn
     * @returns {this}
     */
    pass : function() {
        if(this._lastMovePassed)
            return this.endGame();

        this._lastMovePassed = true;
        this._switchPlayer();

        return this;
    },

    /**
     * Make a turn
     * Returns a flag whether this turn was possible to make
     * @param {Number} col
     * @param {Number} row
     * @returns {Boolean}
     */
    play : function(col, row) {
        if(this._gameOver)
            throw new Error('The game is already over');

        this._attempedSuicide = this._inAtari = false;

        if(this.getStateByPos(col, row) !== EMPTY) {
            console.log('could not play in non empty position ' + col + ', ' + row);
            return false;
        }

        var board = this._board,
            color = board[col][row] = this._currentColor,
            neighbors = this._getAdjacentPoints(col, row),
            captured = [],
            atari = false;

        neighbors.forEach(function(pos) {
            var state = this.getStateByPos(pos);
            if(state === EMPTY || state === color) return;

            var group = this._getGroup(pos[0], pos[1]),
                liberties = group.liberties;

            liberties === 0?
                captured.push(group) :
                liberties === 1 && (atari = true);
        }, this);

        // detect suicide
        if(captured.length === 0 && this._getGroup(col, row).liberties === 0) {
            board[col][row] = EMPTY;
            this._attempedSuicide = true;
            return false;
        }

        captured.forEach(function(group) {
            var stones = group.stones;
            stones.forEach(function(stone) {
                board[stone[0]][stone[1]] = EMPTY;
            });
            this._score[this._currentColor] += stones.length;
        }, this);

        this._inAtari = atari;
        this._lastMovePassed = false;

        this._switchPlayer();

        return true;
    },

    /**
     * End the game
     * @returns {this}
     */
    endGame : function() {
        this._gameOver = true;
        return this;
    }
}, /** @lends Game */{
    EMPTY : EMPTY,
    BLACK : BLACK,
    WHITE : WHITE
}));

});

/* ../../blocks/game/game.js end */
;
/* ../../blocks/go-game/go-game.js begin */
modules.define(
    'go-game',
    ['i-bem__dom', 'BEMHTML', 'jquery', 'board', 'alert', 'players-list', 'pass-button'],
    function(provide, BEMDOM, BEMHTML, $, Board, Alert, PlayersList, PassButton) {

var block = this.name;

provide(BEMDOM.decl(block, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._game = null;
                this._alert = null;
                this._board = null;
                this._playersList = null;
            }
        }
    },

    _getGame : function() {
        return this._game;
    },

    _setGame : function(game) {
        this._game = game;
        return this;
    },

    _getAlert : function() {
        return this._alert || (this._alert = this.findBlockInside('alert'));
    },

    _getBoard : function() {
        return this._board || (this._board = this.findBlockInside('board'));
    },

    _getPlayersList : function() {
        return this._playersList ||
            (this._playersList = this.findBlockInside('players-list'));
    },

    _notify : function() {
        var game = this._getGame(),
            alert = this._getAlert(),
            msg;

        if(game.isGameOver())
            msg = 'GAME OVER';
        else if(game.isInAtari())
            msg = 'ATARI';
        else if(game.isAttemptedSuicide())
            msg = 'SUICIDE';

        msg?
            alert.show(msg) :
            alert.hide();
    },

    _onPlay : function(e, data) {
        var game = this._getGame(),
            isPlayed = game.play(data.col, data.row);

        this._notify();

        if(isPlayed) {
            this._getBoard().update(game);
            this._getPlayersList().update(game);
        }
    },

    _onPassClick : function() {
        this._getPlayersList().update(this._getGame().pass());
        this._notify();
    }
}, {
    live : function() {
        this
            .liveInitOnBlockInsideEvent('play', 'board', function(e, data) {
                this._onPlay(e, data);
            })
            .liveInitOnBlockInsideEvent('click', 'pass-button', function() {
                this._onPassClick();
            });
    },

    create : function(game) {
        return $(BEMHTML.apply(this.build(game)))
            .bem(block)
            ._setGame(game);
    },

    build : function(game) {
        return {
            block : block,
            content : [
                { elem : 'notification', content : Alert.build(game) },
                { elem : 'board', content : Board.build(game) },
                { elem : 'info', content : [
                    PlayersList.build(game),
                    PassButton.build(game)
                ] }
            ]
        };
    }
}));

});

/* ../../blocks/go-game/go-game.js end */
;
/* ../../blocks/board/board.js begin */
modules.define('board', ['i-bem__dom', 'point'], function(provide, BEMDOM, Point) {

/** {Number} size of the grid */
var POINT_SIZE = Point.POINT_SIZE;

provide(BEMDOM.decl(this.name, {
    _getPoints : function() {
        return this._points || (this._points = this.findBlocksInside('point'));
    },

    update : function(game) {
        this._getPoints().forEach(function(point) {
            point.setState(game.getStateByPos(point.getCol(), point.getRow()));
        });
        return this;
    },

    _onPointClick : function(point) {
        this.emit('play', {
            col : point.getCol(),
            row : point.getRow()
        });
    }
}, {
    live : function() {
        this.liveInitOnBlockInsideEvent('click', 'point', function(e) {
            this._onPointClick(e.target);
        });
    },

    build : function(game) {
        var gridSize = game.getSize() * POINT_SIZE;
        return {
            block : this.getName(),
            attrs : {
                style : 'width: ' + gridSize + 'px; height: ' + gridSize + 'px;'
            },
            content : this._fillBoad(game)
        };
    },

    _fillBoad : function(game) {
        var size = game.getSize(),
            lastIdx = size - 1,
            points = [],
            item, mods;

        for(var col = 0; col < size; col++) {
            for(var row = 0; row < size; row++) {
                item = Point.build(game, col, row);
                mods = item.mods || (item.mods = {});

                col === 0 && (mods['first-col'] = true);
                col === lastIdx && (mods['last-col'] = true);

                row === 0 && (mods['first-row'] = true);
                row === lastIdx && (mods['last-row'] = true);

                item.attrs = {
                    style : 'top: ' + col * POINT_SIZE + 'px; left: ' + row * POINT_SIZE + 'px;'
                };

                points.push(item);
            }
        }

        return points;
    }
}));

});

/* ../../blocks/board/board.js end */
;
/* ../../blocks/point/point.js begin */
modules.define('point', ['i-bem__dom', 'game'], function(provide, BEMDOM, Game) {

/** {Number} css size of the point */
var POINT_SIZE = 40;

provide(BEMDOM.decl(this.name, {
    getCol : function() {
        return this.params.col;
    },

    getRow : function() {
        return this.params.row;
    },

    getState : function() {
        return this.getMod('color');
    },

    setState : function(state) {
        state === Game.EMPTY?
            this.delMod('color') :
            this.setMod('color', state === Game.BLACK? 'black' : 'white');
    },

    _onPointerClick : function() {
        this.emit('click');
    }
}, {
    POINT_SIZE : POINT_SIZE,

    live : function() {
        this.liveBindTo('pointerclick', function() {
            this._onPointerClick();
        });
    },

    build : function(game, row, col) {
        var state = game.getStateByPos(row, col),
            mods = {};

        state === Game.EMPTY ||
            (mods.color = state === Game.BLACK? 'black' : 'white');

        return {
            block : this.getName(),
            mods : mods,
            js : {
                col : col,
                row : row
            }
        };
    }
}));

});

/* ../../blocks/point/point.js end */
;
/* ../../libs/bem-core/common.blocks/jquery/__event/_type/jquery__event_type_pointer.js begin */
﻿/**
 * Basic polyfill for Pointer Events W3C Specification.
 *
 * @author Kir Belevich <kir@soulshine.in>
 * @copyright Kir Belevich 2013
 * @license MIT
 * @version 0.5.2
 */
modules.define('jquery', function(provide, $) {

/*
   http://www.w3.org/TR/pointerevents/
   https://dvcs.w3.org/hg/pointerevents/raw-file/tip/pointerEvents.html
   https://dvcs.w3.org/hg/webevents/raw-file/default/touchevents.html
   http://msdn.microsoft.com/en-US/library/ie/hh673557.aspx
   http://www.benalman.com/news/2010/03/jquery-special-events/
   http://api.jquery.com/category/events/event-object/
*/

var win = window,
    doc = win.document,
    binds = {
        mouse: {
            enter: 'mouseenter',
            over: 'mouseover',
            down: 'mousedown',
            move: 'mousemove',
            up: 'mouseup',
            out: 'mouseout',
            leave: 'mouseleave'
        },

        touch: {
            enter: 'touchstart',
            over: 'touchstart',
            down: 'touchstart',
            move: 'touchmove',
            up: 'touchend',
            out: 'touchend',
            leave: 'touchend',
            cancel: 'touchcancel'
        },

        mspointer: {
            over: 'MSPointerOver',
            down: 'MSPointerDown',
            move: 'MSPointerMove',
            up: 'MSPointerUp',
            out: 'MSPointerOut',
            cancel: 'MSPointerCancel'
        }
    };

/**
 * Normalize touch-event by keeping all the
 * possible properties normalized by jQuery.
 *
 * @see http://api.jquery.com/category/events/event-object/
 *
 * @param {Object} e event
 */
function normalizeTouchEvent(e) {

    if(e.pointerType === 'touch') {

        e.originalEvent = e.originalEvent || e;

        // multitouch
        if(e.originalEvent.touches.length > 1) {
            e.multitouch = true;
            return;
        }

        var touchPoint = e.originalEvent.changedTouches[0];

        // keep all the properties normalized by jQuery
        e.clientX = touchPoint.clientX;
        e.clientY = touchPoint.clientY;
        e.pageX = touchPoint.pageX;
        e.pageY = touchPoint.pageY;
        e.screenX = touchPoint.screenX;
        e.screenY = touchPoint.screenY;
        e.layerX = e.originalEvent.layerX;
        e.layerY = e.originalEvent.layerY;
        e.offsetX = e.layerX - e.target.offsetLeft;
        e.offsetY = e.layerY - e.target.offsetTop;
        e.identifier = touchPoint.identifier;
    }

}

/**
 * Extend event to match PointerEvent Interface.
 *
 * @see https://dvcs.w3.org/hg/pointerevents/raw-file/tip/pointerEvents.html#pointer-events-and-interfaces
 * @see https://dvcs.w3.org/hg/webevents/raw-file/default/touchevents.html
 *
 * @param {object} e event
 */
function extendToPointerEvent(e) {

    /*eslint complexity:0*/
    e.width = e.width ||
              e.webkitRadiusX ||
              e.radiusX ||
              0;

    e.height = e.width ||
               e.webkitRadiusY ||
               e.radiusY ||
               0;

    // TODO: stupid Android somehow could send "force" > 1 ;(
    e.pressure = e.pressure ||
                 e.mozPressure ||
                 e.webkitForce ||
                 e.force ||
                 e.which && 0.5 ||
                 0;

    e.tiltX = e.tiltX || 0;
    e.tiltY = e.tiltY || 0;

    switch(e.pointerType) {
        case 2: e.pointerType = 'touch'; break;
        case 3: e.pointerType = 'pen'; break;
        case 4: e.pointerType = 'mouse'; break;
        default: e.pointerType = e.pointerType;
    }

    e.isPrimary = true;

    // "1" is always for mouse, so +2 because of touch can start from 0
    e.pointerId = e.identifier ? e.identifier + 2 : 1;

}

/**
 * Mutate an event to PointerEvent.
 *
 * @param {object} e current event object
 * @param {string} type future pointerevent type
 */
function PointerEvent(e, type) {

    extendToPointerEvent(e);
    normalizeTouchEvent(e);
    e.type = type;

    $.extend(this, e);

}

// export PointerEvent class
$.PointerEvent = PointerEvent;

// nothing to do in IE11 for today
if(win.navigator.pointerEnabled) {
    provide($);
    return;
}

/**
 * Simple nextTick polyfill.
 *
 * @see http://jsperf.com/settimeout-vs-nexttick-polyfill
 *
 * @returns {Function}
 */
function nextTick(callback) {

    var msgName = 'nextTick-polyfill',
        timeouts = [];

    if(win.nextTick) {
        return win.nextTick(callback);
    }

    if(!win.postMessage || win.ActiveXObject) {
        return setTimeout(callback, 0);
    }

    win.addEventListener('message', function(e){
        if(e.source === win && e.data === msgName) {
            if(e.stopPropagation) {
                e.stopPropagation();
            }

            if(timeouts.length) {
                timeouts.shift()();
            }
        }
    }, false);

    timeouts.push(callback);
    win.postMessage(msgName, '*');

}

/**
 * Create new $.event.special wrapper with some default behavior.
 *
 * @param {string} type event type
 * @param {object} toExtend object to extend default wrapper
 */
function addPointerEvent(type, toExtend) {

    var eventName = 'pointer' + type,
        pointerevent,

        eventSpecial = $.event.special[eventName] = {
            // bind
            setup: function() {
                $(this)
                    .on(binds.mouse[type], eventSpecial.mouseHandler)
                    .on(binds.touch[type], eventSpecial.touchHandler)
                    .on(binds.mspointer[type], eventSpecial.msHandler);
            },

            // unbind
            teardown: function() {
                $(this)
                    .off(binds.mouse[type], eventSpecial.mouseHandler)
                    .off(binds.touch[type], eventSpecial.touchHandler)
                    .off(binds.mspointer[type], eventSpecial.msHandler);
            },

            // mouse
            mouseHandler: function(e) {
                // do not duplicate PointerEvent if
                // touch/mspointer is already processed
                if(!eventSpecial._noMouse) {
                    e.pointerType = 4;
                    pointerevent = new PointerEvent(e, eventName);
                    $(e.currentTarget).triggerHandler(pointerevent);
                }

                // clear the "processed" key right after
                // current event and all the bubblings
                nextTick(function() {
                    eventSpecial._noMouse = false;
                });
            },

            // touch
            touchHandler: function(e) {
                // stop mouse events handling
                eventSpecial._noMouse = true;

                e.pointerType = 2;
                pointerevent = new PointerEvent(e, eventName);

                $(e.currentTarget).triggerHandler(pointerevent);
            },

            // mspointer
            msHandler: function(e) {
                // stop mouse events handling
                eventSpecial._noMouse = true;

                pointerevent = new PointerEvent(e, eventName);
                $(e.target).trigger(pointerevent);
            }
        };

    // extend this $.event.special wrapper
    if(toExtend) {
        $.extend(eventSpecial, toExtend({
            event: eventSpecial,
            name: eventName,
            type: type
        }));
    }

}

/**
 * Object to extend $.event.special to touchmove-based events.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function touchmoveBased(params) {

    var event = params.event,
        type = params.type;

    return {
        // bind
        setup: function() {
            $(this)
                .on(binds.mouse[type], event.mouseHandler)
                .on(binds.touch[type], event.touchHandler)
                .on(binds.touch.down, event.touchDownHandler)
                .on(binds.mspointer[type], event.msHandler);

            if(type !== 'move') {
                $(this).on(binds.touch.move, event.touchMoveHandler);
            }
        },

        // unbind
        teardown: function() {
            $(this)
                .off(binds.mouse[type], event.mouseHandler)
                .off(binds.touch[type], event.touchHandler)
                .off(binds.touch.down, event.touchDownHandler)
                .off(binds.mspointer[type], event.msHandler);

            if(type !== 'move') {
                $(this).off(binds.touch.move, event.touchMoveHandler);
            }
        },

        touchDownHandler: function(e) {
            // stop mouse events handling
            event._noMouse = true;
            // save initial target
            event._target = e.target;
        }
    };

}

/**
 * Object to extend $.event.special to pointerenter.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendToEnter(params) {

    return $.extend(touchmoveBased(params), {
        touchMoveHandler: function(e) {
            e.pointerType = 2;

            var pointerevent = new PointerEvent(e, params.name),
                targetFromPoint = doc.elementFromPoint(
                    pointerevent.clientX,
                    pointerevent.clientY
                ),
                target = params.event._target;

            // new target
            if(target !== targetFromPoint) {
                // fix simulated event targets
                pointerevent.relatedTarget = pointerevent.target;
                pointerevent.target = pointerevent.targetFromPoint;

                // inner target
                if(target.contains(targetFromPoint)) {
                    $(targetFromPoint).triggerHandler(pointerevent);
                // truly new target
                } else if(!targetFromPoint.contains(target)) {
                    $(targetFromPoint).trigger(pointerevent);
                }

                // targetFromPoint -> target
                params.event._target = targetFromPoint;
            }
        }
    });

}

/**
 * Object to extend $.event.special to pointerover.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendToOver(params) {

    return $.extend(touchmoveBased(params), {
        touchMoveHandler: function(e) {
            e.pointerType = 2;

            var pointerevent = new PointerEvent(e, params.name),
                targetFromPoint = doc.elementFromPoint(
                    pointerevent.clientX,
                    pointerevent.clientY
                ),
                target = params.event._target;

            // new target
            if(target !== targetFromPoint) {
                // fix simulated event targets
                pointerevent.relatedTarget = pointerevent.target;
                pointerevent.target = pointerevent.targetFromPoint;

                $(targetFromPoint).trigger(pointerevent);

                // targetFromPoint -> target
                params.event._target = targetFromPoint;
            }
        }
    });

}

/**
 * Object to extend $.event.special touchHandler with "target from point".
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendWithTargetFromPoint(params) {

    return {
        touchHandler: function(e) {
            // stop mouse events handling
            params.event._noMouse = true;

            e.pointerType = 2;

            var pointerevent = new PointerEvent(e, params.name),
                targetFromPoint = doc.elementFromPoint(
                    pointerevent.clientX,
                    pointerevent.clientY
                );

            // fix simulated event targets
            pointerevent.relatedTarget = pointerevent.target;
            pointerevent.target = pointerevent.targetFromPoint;

            $(targetFromPoint).triggerHandler(pointerevent);
        }
    };

}

/**
 * Object to extend $.event.special to pointerout.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendToOut(params) {

    return $.extend(
        touchmoveBased(params),
        extendWithTargetFromPoint(params),
        {
            touchMoveHandler: function(e) {
                e.pointerType = 2;

                var pointerevent = new PointerEvent(e, params.name),
                    targetFromPoint = doc.elementFromPoint(
                        pointerevent.clientX,
                        pointerevent.clientY
                    ),
                    target = params.event._target;

                // new target
                if(target !== targetFromPoint) {
                    $(target).trigger(pointerevent);

                    // targetFromPoint -> target
                    params.event._target = targetFromPoint;
                }
            }
        }
    );

}

/**
 * Object to extend $.event.special to pointerleave.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendToLeave(params) {

    return $.extend(
        touchmoveBased(params),
        extendWithTargetFromPoint(params),
        {
            touchMoveHandler: function(e) {
                e.pointerType = 2;

                var pointerevent = new PointerEvent(e, params.name),
                    targetFromPoint = doc.elementFromPoint(
                        pointerevent.clientX,
                        pointerevent.clientY
                    ),
                    target = params.event._target;

                // new target
                if(target !== targetFromPoint) {
                    if(targetFromPoint.contains(target)) {
                        $(target).triggerHandler(pointerevent);
                    } else {
                        $(e.currentTarget).triggerHandler(pointerevent);
                    }

                    // targetFromPoint -> target
                    params.event._target = targetFromPoint;
                }
            }
        }
    );

}

/**
 * Object to extend $.event.special to pointermove.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendToMove(params) {

    return $.extend(
        touchmoveBased(params),
        extendWithTargetFromPoint(params)
    );

}

// init pointer events
addPointerEvent('enter', extendToEnter);
addPointerEvent('over', extendToOver);
addPointerEvent('down');
addPointerEvent('move', extendToMove);
addPointerEvent('up', extendWithTargetFromPoint);
addPointerEvent('out', extendToOut);
addPointerEvent('leave', extendToLeave);
addPointerEvent('cancel');

provide($);

});

/* ../../libs/bem-core/common.blocks/jquery/__event/_type/jquery__event_type_pointer.js end */
;
/* ../../libs/bem-core/common.blocks/jquery/__event/_type/jquery__event_type_pointerclick.js begin */
/**
 * FastClick to jQuery module wrapper.
 * @see https://github.com/ftlabs/fastclick
 */
modules.define('jquery', function(provide, $) {

/**
 * FastClick: polyfill to remove click delays on browsers with touch UIs.
 *
 * @version 0.6.11
 * @copyright The Financial Times Limited [All Rights Reserved]
 * @license MIT License (see LICENSE.txt)
 */

/**
 * @class FastClick
 */

/**
 * Instantiate fast-clicking listeners on the specificed layer.
 *
 * @constructor
 * @param {Element} layer The layer to listen on
 */
function FastClick(layer) {
    'use strict';
    var oldOnClick, self = this;


    /**
     * Whether a click is currently being tracked.
     *
     * @type boolean
     */
    this.trackingClick = false;


    /**
     * Timestamp for when when click tracking started.
     *
     * @type number
     */
    this.trackingClickStart = 0;


    /**
     * The element being tracked for a click.
     *
     * @type EventTarget
     */
    this.targetElement = null;


    /**
     * X-coordinate of touch start event.
     *
     * @type number
     */
    this.touchStartX = 0;


    /**
     * Y-coordinate of touch start event.
     *
     * @type number
     */
    this.touchStartY = 0;


    /**
     * ID of the last touch, retrieved from Touch.identifier.
     *
     * @type number
     */
    this.lastTouchIdentifier = 0;


    /**
     * Touchmove boundary, beyond which a click will be cancelled.
     *
     * @type number
     */
    this.touchBoundary = 10;


    /**
     * The FastClick layer.
     *
     * @type Element
     */
    this.layer = layer;

    if (!layer || !layer.nodeType) {
        throw new TypeError('Layer must be a document node');
    }

    /** @type function() */
    this.onClick = function() { return FastClick.prototype.onClick.apply(self, arguments); };

    /** @type function() */
    this.onMouse = function() { return FastClick.prototype.onMouse.apply(self, arguments); };

    /** @type function() */
    this.onTouchStart = function() { return FastClick.prototype.onTouchStart.apply(self, arguments); };

    /** @type function() */
    this.onTouchMove = function() { return FastClick.prototype.onTouchMove.apply(self, arguments); };

    /** @type function() */
    this.onTouchEnd = function() { return FastClick.prototype.onTouchEnd.apply(self, arguments); };

    /** @type function() */
    this.onTouchCancel = function() { return FastClick.prototype.onTouchCancel.apply(self, arguments); };

    if (FastClick.notNeeded(layer)) {
        return;
    }

    // Set up event handlers as required
    if (this.deviceIsAndroid) {
        layer.addEventListener('mouseover', this.onMouse, true);
        layer.addEventListener('mousedown', this.onMouse, true);
        layer.addEventListener('mouseup', this.onMouse, true);
    }

    layer.addEventListener('click', this.onClick, true);
    layer.addEventListener('touchstart', this.onTouchStart, false);
    layer.addEventListener('touchmove', this.onTouchMove, false);
    layer.addEventListener('touchend', this.onTouchEnd, false);
    layer.addEventListener('touchcancel', this.onTouchCancel, false);

    // Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
    // which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
    // layer when they are cancelled.
    if (!Event.prototype.stopImmediatePropagation) {
        layer.removeEventListener = function(type, callback, capture) {
            var rmv = Node.prototype.removeEventListener;
            if (type === 'click') {
                rmv.call(layer, type, callback.hijacked || callback, capture);
            } else {
                rmv.call(layer, type, callback, capture);
            }
        };

        layer.addEventListener = function(type, callback, capture) {
            var adv = Node.prototype.addEventListener;
            if (type === 'click') {
                adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
                    if (!event.propagationStopped) {
                        callback(event);
                    }
                }), capture);
            } else {
                adv.call(layer, type, callback, capture);
            }
        };
    }

    // If a handler is already declared in the element's onclick attribute, it will be fired before
    // FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
    // adding it as listener.
    if (typeof layer.onclick === 'function') {

        // Android browser on at least 3.2 requires a new reference to the function in layer.onclick
        // - the old one won't work if passed to addEventListener directly.
        oldOnClick = layer.onclick;
        layer.addEventListener('click', function(event) {
            oldOnClick(event);
        }, false);
        layer.onclick = null;
    }
}


/**
 * Android requires exceptions.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0;


/**
 * iOS requires exceptions.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent);


/**
 * iOS 4 requires an exception for select elements.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOS4 = FastClick.prototype.deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


/**
 * iOS 6.0(+?) requires the target element to be manually derived
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOSWithBadTarget = FastClick.prototype.deviceIsIOS && (/OS ([6-9]|\d{2})_\d/).test(navigator.userAgent);


/**
 * Determine whether a given element requires a native click.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element needs a native click
 */
FastClick.prototype.needsClick = function(target) {
    'use strict';
    switch (target.nodeName.toLowerCase()) {

    // Don't send a synthetic click to disabled inputs (issue #62)
    case 'button':
    case 'select':
    case 'textarea':
        if (target.disabled) {
            return true;
        }

        break;
    case 'input':

        // File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
        if ((this.deviceIsIOS && target.type === 'file') || target.disabled) {
            return true;
        }

        break;
    case 'label':
    case 'video':
        return true;
    }

    return (/\bneedsclick\b/).test(target.className);
};


/**
 * Determine whether a given element requires a call to focus to simulate click into element.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
 */
FastClick.prototype.needsFocus = function(target) {
    'use strict';
    switch (target.nodeName.toLowerCase()) {
    case 'textarea':
        return true;
    case 'select':
        return !this.deviceIsAndroid;
    case 'input':
        switch (target.type) {
        case 'button':
        case 'checkbox':
        case 'file':
        case 'image':
        case 'radio':
        case 'submit':
            return false;
        }

        // No point in attempting to focus disabled inputs
        return !target.disabled && !target.readOnly;
    default:
        return (/\bneedsfocus\b/).test(target.className);
    }
};


/**
 * Send a click event to the specified element.
 *
 * @param {EventTarget|Element} targetElement
 * @param {Event} event
 */
FastClick.prototype.sendClick = function(targetElement, event) {
    'use strict';
    var clickEvent, touch;

    // On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
    if (document.activeElement && document.activeElement !== targetElement) {
        document.activeElement.blur();
    }

    touch = event.changedTouches[0];

    // Synthesise a click event, with an extra attribute so it can be tracked
    clickEvent = document.createEvent('MouseEvents');
    clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
    clickEvent.forwardedTouchEvent = true;
    targetElement.dispatchEvent(clickEvent);
};

FastClick.prototype.determineEventType = function(targetElement) {
    'use strict';

    //Issue #159: Android Chrome Select Box does not open with a synthetic click event
    if (this.deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
        return 'mousedown';
    }

    return 'click';
};


/**
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.focus = function(targetElement) {
    'use strict';
    var length;

    // Issue #160: on iOS 7, some input elements (e.g. date datetime) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
    if (this.deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time') {
        length = targetElement.value.length;
        targetElement.setSelectionRange(length, length);
    } else {
        targetElement.focus();
    }
};


/**
 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
 *
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.updateScrollParent = function(targetElement) {
    'use strict';
    var scrollParent, parentElement;

    scrollParent = targetElement.fastClickScrollParent;

    // Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
    // target element was moved to another parent.
    if (!scrollParent || !scrollParent.contains(targetElement)) {
        parentElement = targetElement;
        do {
            if (parentElement.scrollHeight > parentElement.offsetHeight) {
                scrollParent = parentElement;
                targetElement.fastClickScrollParent = parentElement;
                break;
            }

            parentElement = parentElement.parentElement;
        } while (parentElement);
    }

    // Always update the scroll top tracker if possible.
    if (scrollParent) {
        scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
    }
};


/**
 * @param {EventTarget} targetElement
 * @returns {Element|EventTarget}
 */
FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {
    'use strict';

    // On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
    if (eventTarget.nodeType === Node.TEXT_NODE) {
        return eventTarget.parentNode;
    }

    return eventTarget;
};


/**
 * On touch start, record the position and scroll offset.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchStart = function(event) {
    'use strict';
    var targetElement, touch, selection;

    // Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
    if (event.targetTouches.length > 1) {
        return true;
    }

    targetElement = this.getTargetElementFromEventTarget(event.target);
    touch = event.targetTouches[0];

    if (this.deviceIsIOS) {

        // Only trusted events will deselect text on iOS (issue #49)
        selection = window.getSelection();
        if (selection.rangeCount && !selection.isCollapsed) {
            return true;
        }

        if (!this.deviceIsIOS4) {

            // Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
            // when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
            // with the same identifier as the touch event that previously triggered the click that triggered the alert.
            // Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
            // immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
            if (touch.identifier === this.lastTouchIdentifier) {
                event.preventDefault();
                return false;
            }

            this.lastTouchIdentifier = touch.identifier;

            // If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
            // 1) the user does a fling scroll on the scrollable layer
            // 2) the user stops the fling scroll with another tap
            // then the event.target of the last 'touchend' event will be the element that was under the user's finger
            // when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
            // is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
            this.updateScrollParent(targetElement);
        }
    }

    this.trackingClick = true;
    this.trackingClickStart = event.timeStamp;
    this.targetElement = targetElement;

    this.touchStartX = touch.pageX;
    this.touchStartY = touch.pageY;

    // Prevent phantom clicks on fast double-tap (issue #36)
    if ((event.timeStamp - this.lastClickTime) < 200) {
        event.preventDefault();
    }

    return true;
};


/**
 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.touchHasMoved = function(event) {
    'use strict';
    var touch = event.changedTouches[0], boundary = this.touchBoundary;

    if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
        return true;
    }

    return false;
};


/**
 * Update the last position.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchMove = function(event) {
    'use strict';
    if (!this.trackingClick) {
        return true;
    }

    // If the touch has moved, cancel the click tracking
    if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
        this.trackingClick = false;
        this.targetElement = null;
    }

    return true;
};


/**
 * Attempt to find the labelled control for the given label element.
 *
 * @param {EventTarget|HTMLLabelElement} labelElement
 * @returns {Element|null}
 */
FastClick.prototype.findControl = function(labelElement) {
    'use strict';

    // Fast path for newer browsers supporting the HTML5 control attribute
    if (labelElement.control !== undefined) {
        return labelElement.control;
    }

    // All browsers under test that support touch events also support the HTML5 htmlFor attribute
    if (labelElement.htmlFor) {
        return document.getElementById(labelElement.htmlFor);
    }

    // If no for attribute exists, attempt to retrieve the first labellable descendant element
    // the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
    return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
};


/**
 * On touch end, determine whether to send a click event at once.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchEnd = function(event) {
    'use strict';
    var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

    if (!this.trackingClick) {
        return true;
    }

    // Prevent phantom clicks on fast double-tap (issue #36)
    if ((event.timeStamp - this.lastClickTime) < 200) {
        this.cancelNextClick = true;
        return true;
    }

    // Reset to prevent wrong click cancel on input (issue #156).
    this.cancelNextClick = false;

    this.lastClickTime = event.timeStamp;

    trackingClickStart = this.trackingClickStart;
    this.trackingClick = false;
    this.trackingClickStart = 0;

    // On some iOS devices, the targetElement supplied with the event is invalid if the layer
    // is performing a transition or scroll, and has to be re-detected manually. Note that
    // for this to function correctly, it must be called *after* the event target is checked!
    // See issue #57; also filed as rdar://13048589 .
    if (this.deviceIsIOSWithBadTarget) {
        touch = event.changedTouches[0];

        // In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
        targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
        targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
    }

    targetTagName = targetElement.tagName.toLowerCase();
    if (targetTagName === 'label') {
        forElement = this.findControl(targetElement);
        if (forElement) {
            this.focus(targetElement);
            if (this.deviceIsAndroid) {
                return false;
            }

            targetElement = forElement;
        }
    } else if (this.needsFocus(targetElement)) {

        // Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
        // Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
        if ((event.timeStamp - trackingClickStart) > 100 || (this.deviceIsIOS && window.top !== window && targetTagName === 'input')) {
            this.targetElement = null;
            return false;
        }

        this.focus(targetElement);

        // Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
        if (!this.deviceIsIOS4 || targetTagName !== 'select') {
            this.targetElement = null;
            event.preventDefault();
        }

        return false;
    }

    if (this.deviceIsIOS && !this.deviceIsIOS4) {

        // Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
        // and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
        scrollParent = targetElement.fastClickScrollParent;
        if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
            return true;
        }
    }

    // Prevent the actual click from going though - unless the target node is marked as requiring
    // real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
    if (!this.needsClick(targetElement)) {
        event.preventDefault();
        this.sendClick(targetElement, event);
    }

    return false;
};


/**
 * On touch cancel, stop tracking the click.
 *
 * @returns {void}
 */
FastClick.prototype.onTouchCancel = function() {
    'use strict';
    this.trackingClick = false;
    this.targetElement = null;
};


/**
 * Determine mouse events which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onMouse = function(event) {
    'use strict';

    // If a target element was never set (because a touch event was never fired) allow the event
    if (!this.targetElement) {
        return true;
    }

    if (event.forwardedTouchEvent) {
        return true;
    }

    // Programmatically generated events targeting a specific element should be permitted
    if (!event.cancelable) {
        return true;
    }

    // Derive and check the target element to see whether the mouse event needs to be permitted;
    // unless explicitly enabled, prevent non-touch click events from triggering actions,
    // to prevent ghost/doubleclicks.
    if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

        // Prevent any user-added listeners declared on FastClick element from being fired.
        if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
        } else {

            // Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
            event.propagationStopped = true;
        }

        // Cancel the event
        event.stopPropagation();
        event.preventDefault();

        return false;
    }

    // If the mouse event is permitted, return true for the action to go through.
    return true;
};


/**
 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
 * an actual click which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onClick = function(event) {
    'use strict';
    var permitted;

    // It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
    if (this.trackingClick) {
        this.targetElement = null;
        this.trackingClick = false;
        return true;
    }

    // Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
    if (event.target.type === 'submit' && event.detail === 0) {
        return true;
    }

    permitted = this.onMouse(event);

    // Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
    if (!permitted) {
        this.targetElement = null;
    }

    // If clicks are permitted, return true for the action to go through.
    return permitted;
};


/**
 * Remove all FastClick's event listeners.
 *
 * @returns {void}
 */
FastClick.prototype.destroy = function() {
    'use strict';
    var layer = this.layer;

    if (this.deviceIsAndroid) {
        layer.removeEventListener('mouseover', this.onMouse, true);
        layer.removeEventListener('mousedown', this.onMouse, true);
        layer.removeEventListener('mouseup', this.onMouse, true);
    }

    layer.removeEventListener('click', this.onClick, true);
    layer.removeEventListener('touchstart', this.onTouchStart, false);
    layer.removeEventListener('touchmove', this.onTouchMove, false);
    layer.removeEventListener('touchend', this.onTouchEnd, false);
    layer.removeEventListener('touchcancel', this.onTouchCancel, false);
};


/**
 * Check whether FastClick is needed.
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.notNeeded = function(layer) {
    'use strict';
    var metaViewport;

    // Devices that don't support touch don't need FastClick
    if (typeof window.ontouchstart === 'undefined') {
        return true;
    }

    if ((/Chrome\/[0-9]+/).test(navigator.userAgent)) {

        // Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
        if (FastClick.prototype.deviceIsAndroid) {
            metaViewport = document.querySelector('meta[name=viewport]');
            if (metaViewport && metaViewport.content.indexOf('user-scalable=no') !== -1) {
                return true;
            }

        // Chrome desktop doesn't need FastClick (issue #15)
        } else {
            return true;
        }
    }

    // IE10 with -ms-touch-action: none, which disables double-tap-to-zoom (issue #97)
    if (layer.style.msTouchAction === 'none') {
        return true;
    }

    return false;
};


/**
 * Factory method for creating a FastClick object
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.attach = function(layer) {
    'use strict';
    return new FastClick(layer);
};

var event = $.event.special.pointerclick = {
        setup : function() {
            $(this).on('click', event.handler);
        },

        teardown : function() {
            $(this).off('click', event.handler);
        },

        handler : function(e) {
            if(!e.button) {
                e.type = 'pointerclick';
                $.event.dispatch.apply(this, arguments);
                e.type = 'click';
            }
        }
    };

$(function() {
    FastClick.attach(document.body);
    provide($);
});

});

/* ../../libs/bem-core/common.blocks/jquery/__event/_type/jquery__event_type_pointerclick.js end */
;
/* ../../libs/bem-core/common.blocks/jquery/__event/_type/jquery__event_type_pointerpressrelease.js begin */
/**
 * Additional pointerpress and pointerrelease events on top of
 * jquery-pointerevents. Goal – to prevent an accidental pressed
 * states when you just move your finger through the element on
 * touch devices.
 *
 * @author Kir Belevich <kir@soulshine.in>
 * @copyright Kir Belevich 2013
 * @license MIT
 * @version 0.1.0
 */
modules.define('jquery', function(provide, $) {

// nothing to do without jquery-ppinterevents
if(!('PointerEvent' in $)) {
    provide($);
    return;
}

/**
 * Create new $.event.special wrapper with some default behavior.
 *
 * @param {string} type event type
 * @param {object} toExtend object to extend default wrapper
 */
function addPointerEvent(type, toExtend) {

    var eventName = 'pointer' + type,

        eventSpecial = $.event.special[eventName] = {
            // bind
            setup: function() {
                $(this).on({
                    pointerdown: eventSpecial.handlerDown,
                    pointermove: eventSpecial.handlerMove,
                    pointerup: eventSpecial.handlerUp
                });
            },

            // unbind
            teardown: function() {
                $(this).off({
                    pointerdown: eventSpecial.handlerDown,
                    pointermove: eventSpecial.handlerMove,
                    pointerup: eventSpecial.handlerUp
                });
            },

            handlerMove: function(e) {

                if(e.pointerType === 'touch') {
                    var data = eventSpecial.data;

                    // if there is a touch move
                    if(
                       data &&
                       (Math.abs(e.clientX - data.clientX) > 5 ||
                       Math.abs(e.clientY - data.clientY) > 5)
                    ) {
                        // save that
                        data.move = true;
                    }
                }
            }
        };

    // extend this $.event.special wrapper
    if(toExtend) {
        $.extend(eventSpecial, toExtend({
            event: eventSpecial,
            name: eventName,
            type: type
        }));
    }

}

/**
 * Object to extend $.event.special to handle pointerpress.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendPointerPress(params) {

    var data = params.event.data;

    return {
        handlerDown: function(e) {
            var target = e.target,
                pointerevent;

            // touch
            if(e.pointerType === 'touch') {
                data = {
                    timer: (function() {
                        // if there was no touchmove in 80ms – trigger pointerpress
                        return setTimeout(function() {
                            if(data && !data.move) {
                                pointerevent = new $.PointerEvent(e, params.name);
                                $(e.currentTarget).triggerHandler(pointerevent);
                            }
                        }, 80);
                    })(),
                    clientX: e.clientX,
                    clientY: e.clientY
                };
            // mouse – only left button
            } else if(e.which === 1) {
                pointerevent = new $.PointerEvent(e, params.name);
                $(e.currentTarget).triggerHandler(pointerevent);
            }
        },

        handlerUp: function(e) {
            if(e.pointerType === 'touch') {
                if(data) {
                    clearTimeout(data.timer);
                }
                data = null;
            }
        }
    };

}

/**
 * Object to extend $.event.special to handle pointerpress.
 *
 * @param {object} params
 * @param {object} params.event event object
 * @param {string} params.name event name
 * @param {string} params.type event type
 * @returns {object}
 */
function extendPointerRelease(params) {

    var data = params.event.data;

    return {
        handlerDown: function(e) {
            var target = e.target,
                pointerevent;

            // touch
            if(e.pointerType === 'touch') {
                data = {
                    timer: (function() {
                        // if there was no touchmove in 80ms – trigger pointerpress
                        return setTimeout(function() {
                            if(data && !data.move) {
                                data.pressed = true;
                            }
                        }, 80);
                    })(),
                    clientX: e.clientX,
                    clientY: e.clientY
                };
            }
        },

        handlerUp: function(e) {
            var pointerevent;

            // touch
            if(e.pointerType === 'touch') {
                if(data && data.pressed) {
                    pointerevent = new $.PointerEvent(e, params.name);
                    $(e.target).trigger(pointerevent);
                }

                if(data) {
                    clearTimeout(data.timer);
                }

                data = null;
            // mouse – only left button
            } else if(e.which === 1) {
                pointerevent = new $.PointerEvent(e, params.name);
                $(e.currentTarget).triggerHandler(pointerevent);
            }
        }
    };

}

// init pointer events
addPointerEvent('press', extendPointerPress);
addPointerEvent('release', extendPointerRelease);

provide($);

});

/* ../../libs/bem-core/common.blocks/jquery/__event/_type/jquery__event_type_pointerpressrelease.js end */
;
/* ../../blocks/player/player.js begin */
modules.define('player', ['i-bem__dom', 'game'], function(provide, BEMDOM, Game) {

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._val = this.params.val;
            }
        }
    },

    getColor : function() {
        return this.params.color
    },

    getVal : function() {
        return this._val;
    },

    setVal : function(val) {
        if(val !== this._val) {
            this.elem('score').text(this._val = val);
            this.emit('change');
        }
        return this;
    }
}, {
    live : true,

    build : function(game, color) {
        var val = game.getScore(color),
            isBlack = color === Game.BLACK;
        return {
            block : this.getName(),
            mods : { color : isBlack? 'black' : 'white' },
            js : { val : val, color : color },
            content : [
                isBlack? 'BLACK' : 'WHITE',
                { elem : 'score', content : val }
            ]
        };
    }
}));

});

/* ../../blocks/player/player.js end */
;
/* ../../blocks/alert/alert.js begin */
modules.define('alert', ['i-bem__dom'], function(provide, BEMDOM) {

provide(BEMDOM.decl(this.name, {
    show : function(msg) {
        BEMDOM.update(this.domElem, msg);
        this.setMod('visible');
    },

    hide : function() {
        this.delMod('visible');
    }
}, {
    build : function() {
        return { block : this.getName() };
    }
}));

});

/* ../../blocks/alert/alert.js end */
;
/* ../../blocks/pass-button/pass-button.js begin */
modules.define('pass-button', ['i-bem__dom'], function(provide, BEMDOM) {

provide(BEMDOM.decl(this.name, {
    _onPointerClick : function() {
        this.emit('click');
    }
}, {
    live : function() {
        this.liveBindTo('pointerclick', function() {
            this._onPointerClick();
        });
    },

    build : function() {
        return { block : this.getName(), content : 'PASS TURN' };
    }
}));

});

/* ../../blocks/pass-button/pass-button.js end */
;
/* ../../blocks/players-list/players-list.js begin */
modules.define('players-list', ['i-bem__dom', 'player', 'game'], function(provide, BEMDOM, Player, Game) {

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        'js' : {
            'inited' : function() {
                this._players = null;
            }
        }
    },

    _getPlayers : function() {
        return this._players ||
            (this._players = this.findBlocksInside('player'));
    },

    update : function(game) {
        var currentColor = game.getCurrentColor(),
            color;
        this._getPlayers().forEach(function(player) {
            color = player.getColor();
            player
                .setVal(game.getScore(color))
                .toggleMod('current', true, '', color === currentColor);
        });
        return this;
    }
}, {
    live : true,

    build : function(game) {
        var playerBlack = this._buildPlayer(game, Game.BLACK),
            playerWhite = this._buildPlayer(game, Game.WHITE);

        playerBlack.mods.current = true;

        return {
            block : this.getName(),
            content : [
                playerBlack,
                playerWhite
            ]
        };
    },

    _buildPlayer : function(game, color) {
        var player = Player.build(game, color);

        player.mods || (player.mods = {});
        (player.mix || (player.mix = [])).push({ block : this.getName(), elem : 'player' });

        return player;
    }
}));

});

/* ../../blocks/players-list/players-list.js end */
;
(function(g) {
  var __bem_xjst = (function(exports) {
     var __$ref={};function apply(ctx){try{return applyc(ctx||this,__$ref)}catch(e){(ctx||this).xjstContext=e;throw e}}exports.apply=apply;function applyc(__$ctx,__$ref){var __$t=__$ctx._mode;if(__$t==="mix"){if(__$ctx.block==="players-list"&&!__$ctx.elem){__$ctx.__$a=0;return{block:"clearfix"}}__$ctx.__$a=0;return undefined}else if(__$t==="js"){var __$t=__$ctx.block;if(__$t==="players-list"){if(!__$ctx.elem){__$ctx.__$a=0;return true}}else if(__$t==="pass-button"){if(!__$ctx.elem){__$ctx.__$a=0;return true}}else if(__$t==="alert"){if(!__$ctx.elem){__$ctx.__$a=0;return true}}else if(__$t==="board"){if(!__$ctx.elem){__$ctx.__$a=0;return true}}else if(__$t==="go-game"){if(!__$ctx.elem){__$ctx.__$a=0;return true}}__$ctx.__$a=0;return undefined}else if(__$t==="tag"){var __$t=__$ctx.block;if(__$t==="pass-button"){if(!__$ctx.elem){__$ctx.__$a=0;return"button"}}else if(__$t==="ua"){if(!__$ctx.elem){__$ctx.__$a=0;return"script"}}__$ctx.__$a=0;return undefined}else if(__$t==="content"){if(__$ctx.block==="ua"&&!__$ctx.elem){__$ctx.__$a=0;return["(function(e,c){",'e[c]=e[c].replace(/(ua_js_)no/g,"$1yes");','})(document.documentElement,"className");']}__$ctx.__$a=0;return __$ctx.ctx.content}else if(__$t==="bem"){if(__$ctx.block==="ua"&&!__$ctx.elem){__$ctx.__$a=0;return false}__$ctx.__$a=0;return undefined}else if(__$t==="cls"){__$ctx.__$a=0;return undefined}else if(__$t==="attrs"){__$ctx.__$a=0;return undefined}else if(__$t==="default"){__$ctx.__$a=0;var __$r=__$b18(__$ctx,__$ref);if(__$r!==__$ref)return __$r}else if(__$t===""){if(__$ctx.ctx&&__$ctx.ctx._vow&&__$ctx.__$a!==1){__$ctx.__$a=0;var __$r=__$b19(__$ctx,__$ref);if(__$r!==__$ref)return __$r}if(__$ctx._.isSimple(__$ctx.ctx)){__$ctx.__$a=0;var __$r=__$b20(__$ctx,__$ref);if(__$r!==__$ref)return __$r}if(!__$ctx.ctx){__$ctx.__$a=0;var __$r=__$b21(__$ctx,__$ref);if(__$r!==__$ref)return __$r}if(__$ctx._.isArray(__$ctx.ctx)){__$ctx.__$a=0;var __$r=__$b22(__$ctx,__$ref);if(__$r!==__$ref)return __$r}__$ctx.__$a=0;var __$r=__$b23(__$ctx,__$ref);if(__$r!==__$ref)return __$r}__$ctx.__$a=0}[function(exports){var BEM_={},toString=Object.prototype.toString,isArray=Array.isArray||function(obj){return toString.call(obj)==="[object Array]"},SHORT_TAGS={area:1,base:1,br:1,col:1,command:1,embed:1,hr:1,img:1,input:1,keygen:1,link:1,meta:1,param:1,source:1,wbr:1};!function(BEM,undefined){var MOD_DELIM="_",ELEM_DELIM="__",NAME_PATTERN="[a-zA-Z0-9-]+";function buildModPostfix(modName,modVal){var res=MOD_DELIM+modName;if(modVal!==true)res+=MOD_DELIM+modVal;return res}function buildBlockClass(name,modName,modVal){var res=name;if(modVal)res+=buildModPostfix(modName,modVal);return res}function buildElemClass(block,name,modName,modVal){var res=buildBlockClass(block)+ELEM_DELIM+name;if(modVal)res+=buildModPostfix(modName,modVal);return res}BEM.INTERNAL={NAME_PATTERN:NAME_PATTERN,MOD_DELIM:MOD_DELIM,ELEM_DELIM:ELEM_DELIM,buildModPostfix:buildModPostfix,buildClass:function(block,elem,modName,modVal){var typeOfModName=typeof modName;if(typeOfModName==="string"||typeOfModName==="boolean"){var typeOfModVal=typeof modVal;if(typeOfModVal!=="string"&&typeOfModVal!=="boolean"){modVal=modName;modName=elem;elem=undefined}}else if(typeOfModName!=="undefined"){modName=undefined}else if(elem&&typeof elem!=="string"){elem=undefined}if(!(elem||modName)){return block}if(elem)return buildElemClass(block,elem,modName,modVal);else return buildBlockClass(block,modName,modVal)},buildModsClasses:function(block,elem,mods){var res="";if(mods){var modName;for(modName in mods){if(!mods.hasOwnProperty(modName))continue;var modVal=mods[modName];if(!modVal&&modVal!==0)continue;typeof modVal!=="boolean"&&(modVal+="");res+=" "+(elem?buildElemClass(block,elem,modName,modVal):buildBlockClass(block,modName,modVal))}}return res},buildClasses:function(block,elem,mods){var res="";if(elem)res+=buildElemClass(block,elem);else res+=buildBlockClass(block);res+=this.buildModsClasses(block,elem,mods);return res}}}(BEM_);var ts={'"':"&quot;","&":"&amp;","<":"&lt;",">":"&gt;"},f=function(t){return ts[t]||t};var buildEscape=function(r){r=new RegExp(r,"g");return function(s){return(""+s).replace(r,f)}};function BEMContext(context,apply_){this.ctx=typeof context===null?"":context;this.apply=apply_;this._str="";var self=this;this._buf={push:function(){var chunks=Array.prototype.slice.call(arguments).join("");self._str+=chunks},join:function(){return this._str}};this._=this;this._start=true;this._mode="";this._listLength=0;this._notNewList=false;this.position=0;this.block=undefined;this.elem=undefined;this.mods=undefined;this.elemMods=undefined}BEMContext.prototype.isArray=isArray;BEMContext.prototype.isSimple=function isSimple(obj){var t=typeof obj;return t==="string"||t==="number"||t==="boolean"};BEMContext.prototype.isShortTag=function isShortTag(t){return SHORT_TAGS.hasOwnProperty(t)};BEMContext.prototype.extend=function extend(o1,o2){if(!o1||!o2)return o1||o2;var res={},n;for(n in o1)o1.hasOwnProperty(n)&&(res[n]=o1[n]);for(n in o2)o2.hasOwnProperty(n)&&(res[n]=o2[n]);return res};var cnt=0,id=+new Date,expando="__"+id,get=function(){return"uniq"+id+ ++cnt};BEMContext.prototype.identify=function(obj,onlyGet){if(!obj)return get();if(onlyGet||obj[expando]){return obj[expando]}else{return obj[expando]=get()}};BEMContext.prototype.xmlEscape=buildEscape("[&<>]");BEMContext.prototype.attrEscape=buildEscape('["&<>]');BEMContext.prototype.BEM=BEM_;BEMContext.prototype.isFirst=function isFirst(){return this.position===1};BEMContext.prototype.isLast=function isLast(){return this.position===this._listLength};BEMContext.prototype.generateId=function generateId(){return this.identify(this.ctx)};var oldApply=exports.apply;exports.apply=BEMContext.apply=function _apply(context){var ctx=new BEMContext(context||this,oldApply);ctx.apply();return ctx._str};BEMContext.prototype.reapply=BEMContext.apply}].forEach(function(fn){fn(exports,this)},{recordExtensions:function(ctx){ctx._str=undefined;ctx._mode=undefined;ctx.block=undefined;ctx.elem=undefined;ctx._notNewList=undefined;ctx.position=undefined;ctx._listLength=undefined;ctx.ctx=undefined;ctx.__$a=0;ctx._currBlock=undefined;ctx.mods=undefined;ctx.elemMods=undefined}});function __$b18(__$ctx,__$ref){__$ctx.__$a=0;var _this__$0=__$ctx,BEM___$1=_this__$0.BEM,v__$2=__$ctx.ctx,isBEM__$3,tag__$4,result__$5;var __$r__$6;var __$l0__$7=__$ctx._str;__$ctx._str="";var __$r__$8;var __$l1__$9=__$ctx._mode;__$ctx._mode="tag";__$r__$8=applyc(__$ctx,__$ref);__$ctx._mode=__$l1__$9;tag__$4=__$r__$8;typeof tag__$4!=="undefined"||(tag__$4=v__$2.tag);typeof tag__$4!=="undefined"||(tag__$4="div");if(tag__$4){var jsParams__$10,js__$11;if(__$ctx.block&&v__$2.js!==false){var __$r__$12;var __$l2__$13=__$ctx._mode;__$ctx._mode="js";__$r__$12=applyc(__$ctx,__$ref);__$ctx._mode=__$l2__$13;js__$11=__$r__$12;js__$11=js__$11?__$ctx._.extend(v__$2.js,js__$11===true?{}:js__$11):v__$2.js===true?{}:v__$2.js;js__$11&&((jsParams__$10={})[BEM___$1.INTERNAL.buildClass(__$ctx.block,v__$2.elem)]=js__$11)}__$ctx._str+="<"+tag__$4;var __$r__$14;var __$l3__$15=__$ctx._mode;__$ctx._mode="bem";__$r__$14=applyc(__$ctx,__$ref);__$ctx._mode=__$l3__$15;isBEM__$3=__$r__$14;typeof isBEM__$3!=="undefined"||(isBEM__$3=typeof v__$2.bem!=="undefined"?v__$2.bem:v__$2.block||v__$2.elem);var __$r__$17;var __$l4__$18=__$ctx._mode;__$ctx._mode="cls";__$r__$17=applyc(__$ctx,__$ref);__$ctx._mode=__$l4__$18;var cls__$16=__$r__$17;cls__$16||(cls__$16=v__$2.cls);var addJSInitClass__$19=v__$2.block&&jsParams__$10;if(isBEM__$3||cls__$16){__$ctx._str+=' class="';if(isBEM__$3){__$ctx._str+=BEM___$1.INTERNAL.buildClasses(__$ctx.block,v__$2.elem,v__$2.elemMods||v__$2.mods);var __$r__$21;var __$l5__$22=__$ctx._mode;__$ctx._mode="mix";__$r__$21=applyc(__$ctx,__$ref);__$ctx._mode=__$l5__$22;var mix__$20=__$r__$21;v__$2.mix&&(mix__$20=mix__$20?mix__$20.concat(v__$2.mix):v__$2.mix);if(mix__$20){var visited__$23={},visitedKey__$24=function(block,elem){return(block||"")+"__"+(elem||"")};visited__$23[visitedKey__$24(__$ctx.block,__$ctx.elem)]=true;if(!__$ctx._.isArray(mix__$20))mix__$20=[mix__$20];for(var i__$25=0;i__$25<mix__$20.length;i__$25++){var mixItem__$26=mix__$20[i__$25],hasItem__$27=mixItem__$26.block||mixItem__$26.elem,block__$28=mixItem__$26.block||mixItem__$26._block||_this__$0.block,elem__$29=mixItem__$26.elem||mixItem__$26._elem||_this__$0.elem;if(hasItem__$27)__$ctx._str+=" ";__$ctx._str+=BEM___$1.INTERNAL[hasItem__$27?"buildClasses":"buildModsClasses"](block__$28,mixItem__$26.elem||mixItem__$26._elem||(mixItem__$26.block?undefined:_this__$0.elem),mixItem__$26.elemMods||mixItem__$26.mods);if(mixItem__$26.js){(jsParams__$10||(jsParams__$10={}))[BEM___$1.INTERNAL.buildClass(block__$28,mixItem__$26.elem)]=mixItem__$26.js===true?{}:mixItem__$26.js;addJSInitClass__$19||(addJSInitClass__$19=block__$28&&!mixItem__$26.elem)}if(hasItem__$27&&!visited__$23[visitedKey__$24(block__$28,elem__$29)]){visited__$23[visitedKey__$24(block__$28,elem__$29)]=true;var __$r__$31;var __$l6__$32=__$ctx._mode;__$ctx._mode="mix";var __$l7__$33=__$ctx.block;__$ctx.block=block__$28;var __$l8__$34=__$ctx.elem;__$ctx.elem=elem__$29;__$r__$31=applyc(__$ctx,__$ref);__$ctx._mode=__$l6__$32;__$ctx.block=__$l7__$33;__$ctx.elem=__$l8__$34;var nestedMix__$30=__$r__$31;if(nestedMix__$30){for(var j__$35=0;j__$35<nestedMix__$30.length;j__$35++){var nestedItem__$36=nestedMix__$30[j__$35];if(!nestedItem__$36.block&&!nestedItem__$36.elem||!visited__$23[visitedKey__$24(nestedItem__$36.block,nestedItem__$36.elem)]){nestedItem__$36._block=block__$28;nestedItem__$36._elem=elem__$29;mix__$20.splice(i__$25+1,0,nestedItem__$36)}}}}}}}if(cls__$16)__$ctx._str+=isBEM__$3?" "+cls__$16:cls__$16;if(addJSInitClass__$19)__$ctx._str+=' i-bem"';else __$ctx._str+='"'}if(isBEM__$3&&jsParams__$10){__$ctx._str+=' data-bem="'+__$ctx._.attrEscape(JSON.stringify(jsParams__$10))+'"'}var __$r__$38;var __$l9__$39=__$ctx._mode;__$ctx._mode="attrs";__$r__$38=applyc(__$ctx,__$ref);__$ctx._mode=__$l9__$39;var attrs__$37=__$r__$38;attrs__$37=__$ctx._.extend(attrs__$37,v__$2.attrs);if(attrs__$37){var name__$40,attr__$41;for(name__$40 in attrs__$37){attr__$41=attrs__$37[name__$40];if(attr__$41===undefined)continue;__$ctx._str+=" "+name__$40+'="'+__$ctx._.attrEscape(__$ctx._.isSimple(attr__$41)?attr__$41:__$ctx.reapply(attr__$41))+'"'}}}if(__$ctx._.isShortTag(tag__$4)){__$ctx._str+="/>"}else{if(tag__$4)__$ctx._str+=">";var __$r__$43;var __$l10__$44=__$ctx._mode;__$ctx._mode="content";__$r__$43=applyc(__$ctx,__$ref);__$ctx._mode=__$l10__$44;var content__$42=__$r__$43;if(content__$42||content__$42===0){isBEM__$3=__$ctx.block||__$ctx.elem;var __$r__$45;var __$l11__$46=__$ctx._mode;__$ctx._mode="";var __$l12__$47=__$ctx._notNewList;__$ctx._notNewList=false;var __$l13__$48=__$ctx.position;__$ctx.position=isBEM__$3?1:__$ctx.position;var __$l14__$49=__$ctx._listLength;__$ctx._listLength=isBEM__$3?1:__$ctx._listLength;var __$l15__$50=__$ctx.ctx;__$ctx.ctx=content__$42;__$r__$45=applyc(__$ctx,__$ref);__$ctx._mode=__$l11__$46;__$ctx._notNewList=__$l12__$47;__$ctx.position=__$l13__$48;__$ctx._listLength=__$l14__$49;__$ctx.ctx=__$l15__$50}if(tag__$4)__$ctx._str+="</"+tag__$4+">"}result__$5=__$ctx._str;__$r__$6=undefined;__$ctx._str=__$l0__$7;__$ctx._buf.push(result__$5);return}function __$b19(__$ctx,__$ref){__$ctx.__$a=0;var __$r__$51;var __$l0__$52=__$ctx._mode;__$ctx._mode="";var __$l1__$53=__$ctx.ctx;__$ctx.ctx=__$ctx.ctx._value;var __$r__$54;__$ctx.__$a=1;__$r__$54=applyc(__$ctx,__$ref);__$r__$51=__$r__$54;__$ctx._mode=__$l0__$52;__$ctx.ctx=__$l1__$53;return}function __$b20(__$ctx,__$ref){__$ctx.__$a=0;__$ctx._listLength--;var ctx__$55=__$ctx.ctx;if(ctx__$55&&ctx__$55!==true||ctx__$55===0){__$ctx._buf.push(ctx__$55+"")}return}function __$b21(__$ctx,__$ref){__$ctx.__$a=0;__$ctx._listLength--;return}function __$b22(__$ctx,__$ref){__$ctx.__$a=0;var v__$56=__$ctx.ctx,l__$57=v__$56.length,i__$58=0,prevPos__$59=__$ctx.position,prevNotNewList__$60=__$ctx._notNewList;if(prevNotNewList__$60){__$ctx._listLength+=l__$57-1}else{__$ctx.position=0;__$ctx._listLength=l__$57}__$ctx._notNewList=true;while(i__$58<l__$57)!function(){var __$r__$61;var __$l0__$62=__$ctx.ctx;__$ctx.ctx=v__$56[i__$58++];__$r__$61=applyc(__$ctx,__$ref);__$ctx.ctx=__$l0__$62;return __$r__$61}();prevNotNewList__$60||(__$ctx.position=prevPos__$59);return}function __$b23(__$ctx,__$ref){__$ctx.__$a=0;var vBlock__$63=__$ctx.ctx.block,vElem__$64=__$ctx.ctx.elem,block__$65=__$ctx._currBlock||__$ctx.block;__$ctx.ctx||(__$ctx.ctx={});var __$r__$66;var __$l0__$67=__$ctx._mode;__$ctx._mode="default";var __$l1__$68=__$ctx.block;__$ctx.block=vBlock__$63||(vElem__$64?block__$65:undefined);var __$l2__$69=__$ctx._currBlock;__$ctx._currBlock=vBlock__$63||vElem__$64?undefined:block__$65;var __$l3__$70=__$ctx.elem;__$ctx.elem=__$ctx.ctx.elem;var __$l4__$71=__$ctx.mods;__$ctx.mods=vBlock__$63?__$ctx.ctx.mods||(__$ctx.ctx.mods={}):__$ctx.mods;var __$l5__$72=__$ctx.elemMods;__$ctx.elemMods=__$ctx.ctx.elemMods||{};__$ctx.block||__$ctx.elem?__$ctx.position=(__$ctx.position||0)+1:__$ctx._listLength--;applyc(__$ctx,__$ref);__$r__$66=undefined;__$ctx._mode=__$l0__$67;__$ctx.block=__$l1__$68;__$ctx._currBlock=__$l2__$69;__$ctx.elem=__$l3__$70;__$ctx.mods=__$l4__$71;__$ctx.elemMods=__$l5__$72;return};
     return exports;
  })({});
  var defineAsGlobal = true;
  if(typeof exports === "object") {
    exports["BEMHTML"] = __bem_xjst;
    defineAsGlobal = false;
  }
  if(typeof modules === "object") {
    modules.define("BEMHTML",
                   function(provide) { provide(__bem_xjst) });
    defineAsGlobal = false;
  }
  defineAsGlobal && (g["BEMHTML"] = __bem_xjst);
})(this);