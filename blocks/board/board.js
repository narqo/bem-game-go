modules.define('board', ['i-bem__dom', 'point'], function(provide, BEMDOM, Point) {

/** {Number} size of the grid */
var POINT_SIZE = Point.POINT_SIZE;

provide(BEMDOM.decl(this.name, {
    _onPointClick : function(e) {
        var point = e.target;
        this.emit('play', {
            row : point.getRow(),
            col : point.getCol()
        });
    }
}, {
    live : function() {
        this.liveInitOnBlockInsideEvent('click', 'point', function(e) {
            this._onPointClick(e);
        });
    },

    build : function(game) {
        var gridSize = game.getSize() * POINT_SIZE;
        return {
            block : this.getName(),
            attrs : {
                style : 'width: ' + gridSize + 'px; height: ' + gridSize + 'px;'
            },
            content : this.updateGrid(game)
        };
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
                    style : 'top: ' + row * POINT_SIZE + 'px; left: ' + col * POINT_SIZE + 'px;'
                };

                points.push(item);
            }
        }

        return points;
    }
}));

});
