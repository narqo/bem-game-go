modules.define(
    { block : 'alert' },
    ['i-bem__dom'],
    function(provide, BEMDOM) {

provide({
    notify : function(msg) {
        BEMDOM.update(this.domElem, msg);
    }
}, {
    build : function() {
        return { block : this.getName() };
    }
});

});
