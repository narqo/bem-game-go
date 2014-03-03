modules.define({ block : 'pass-button' }, function(provide) {

provide({
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
        return { block : this.getName() };
    }
});

});
