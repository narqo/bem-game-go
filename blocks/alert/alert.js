modules.define('alert', ['i-bem__dom'], function(provide, BEMDOM) {

provide(BEMDOM.decl(this.name, {
    notify : function(msg) {
        BEMDOM.update(this.domElem, msg);
    }
}, {
    build : function() {
        return { block : this.getName() };
    }
}));

});
