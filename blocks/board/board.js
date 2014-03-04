modules.define(
    'board',
    ['i-bem__dom', 'BEMHTML', 'alert', 'pass-button', 'point', 'game'],
    function(provide, BEMDOM, BEMHTML, Alert, PassButton, Point, Game) {

/** {Number} size of the grid */
var GAME_SIZE = 9,
    pointSize = Point.POINT_SIZE,
    gridSize = GAME_SIZE * pointSize;

provide(BEMDOM.decl(this.name, {
    onSetMod : {
        js : {
            inited : function() {
                this._game = new Game(GAME_SIZE);
                this._alert = null;

                this._render();

                Point.on(this.elem('grid'), 'click', this._onPointClick, this);
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

    _onPointClick : function(e) {
        var game = this._game,
            alert = this._getAlert(),
            intersection = e.target,
            row = intersection.getRow(),
            col = intersection.getCol(),
            succeed = game.play(row, col);

        game.isInAtari() && alert.notify('ATARI');
        game.isAttemptedSuicide() && alert.notify('SUICIDE');

        succeed &&
            BEMDOM.update(this.elem('grid'), BEMHTML.apply(this.__self.updateGrid(this._game)));
    }
}, {
    live : false,

    build : function(game) {
        return [
            Alert.build(game),
            PassButton.build(game),
            {
                block : this.getName(),
                elem : 'grid',
                attrs : {
                    style : 'width: ' + gridSize + 'px; height: ' + gridSize + 'px;'
                },
                content : this.updateGrid(game)
            }
        ];
    },

    updateGrid : function(game) {
        var size = game.getSize(),
            lastIdx = size - 1,
            points = [],
            item, mods;

        for(var row = 0; row < size; row++) {
            for(var col = 0; col < size; col++) {
                item = Point.build(game, row, col);
                mods = item.mods;

                row === 0 && (mods['is-first-row'] = true);
                row === lastIdx && (mods['is-last-row'] = true);

                col === 0 && (mods['is-first-col'] = true);
                col === lastIdx && (mods['is-last-col'] = true);

                item.attrs = {
                    style : 'top: ' + row * pointSize + 'px; left: ' + col * pointSize + 'px;'
                };

                points.push(item);
            }
        }

        return points;
    }
}));

});
