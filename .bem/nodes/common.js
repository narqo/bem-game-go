var environ = require('bem-environ');

module.exports = function(registry) {
    require(environ.getLibPath('bem-pr', 'bem/nodes'))(registry);

    registry.decl('Arch', {
        createCustomNodes : function() {
            var SetsNode = registry.getNodeClass('SetsNode');
            if(typeof SetsNode.createId === 'undefined') {
                return;
            }

            return SetsNode
                .create({ root : this.root, arch : this.arch })
                .alterArch();
        }
    });
};
