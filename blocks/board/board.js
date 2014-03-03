modules.define(
    { block : 'board' },
    ['i-bem__dom', 'BEMHTML', 'alert', 'pass-button', 'intersection', 'game'],
    function(provide, BEMDOM, BEMHTML, Alert, PassButton, Intersection, Game) {

// размер игрового поля
var GAME_SIZE = 5,
    // размер клетки
    GRID_SIZE = 40;

provide({
    onSetMod : {
        js : {
            inited : function() {
                this._game = new Game(GAME_SIZE);
                this._alert = null;

                this._render();

                Intersection.on(this.elem('container'), 'click', this._onIntersectionClick, this);
                PassButton.on('click', this._onPassClick, this);
            }
        }
    },

    _render : function() {
        BEMDOM.update(this.domElem, BEMHTML.apply(this.__self.build(this._game)));
    },

    _getAlert : function() {
        return this._alert || (this._alert = this.findBlockInside('alert'));
    },

    _onPassClick : function() {
        this._game.pass();
    },

    _onIntersectionClick : function(e) {
        var game = this._game,
            alert = this._getAlert(),
            intersection = e.target,
            row = intersection.getRow(),
            col = intersection.getCol(),
            succeed = game.play(row, col);

        game.isInAtari() && alert.notify('ATARI');
        game.isAttemptedSuicide() && alert.notify('SUICIDE');

        succeed &&
            BEMDOM.update(this.elem('container'), BEMHTML.apply(this.__self.updateContainer(this._game)));
    }
}, {
    live : false,

    build : function(game) {
        var containerSize = GRID_SIZE * GAME_SIZE;
        return [
            Alert.build(game),
            PassButton.build(game),
            {
                block : this.getName(),
                elem : 'container',
                attrs : {
                    style : 'width: ' + containerSize + 'px; height: ' + containerSize + 'px;'
                },
                content : this.updateContainer(game)
            }
        ];
    },

    updateContainer : function(game) {
        var size = game.getSize(),
            intersections = [],
            item;

        for(var i = 0; i < size; i++) {
            for(var j = 0; j < size; j++) {
                item = Intersection.build(game, i, j);
                item.attrs = {
                    style : 'top: ' + i * GRID_SIZE + 'px; left: ' + j * GRID_SIZE + 'px;'
                };
                intersections.push(item);
            }
        }

        return intersections;
    }
});

});
