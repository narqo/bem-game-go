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
