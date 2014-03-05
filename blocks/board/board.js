modules.define('board', ['i-bem__dom', 'point'], function(provide, BEMDOM, Point) {

/** {Number} size of the grid */
var POINT_SIZE = Point.POINT_SIZE;

provide(BEMDOM.decl(this.name, {
    _getPoints : function() {
        return this._points || (this._points = this.findBlocksInside('point'));
    },

    updateBoard : function(game) {
        this._getPoints().forEach(function(point) {
            point.setState(game.getStateByPos(point.getRow(), point.getCol()));
        });
    },

    _onPointClick : function(point) {
        this.emit('play', {
            row : point.getRow(),
            col : point.getCol()
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

        for(var row = 0; row < size; row++) {
            for(var col = 0; col < size; col++) {
                item = Point.build(game, row, col);
                mods = item.mods || (item.mods = {});

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
