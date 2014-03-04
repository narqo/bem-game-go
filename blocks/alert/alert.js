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
