define(function(require, exports, module) {
    var Entity = require('famous/core/Entity');
    var Group = require('famous/core/Group');
    var OptionsManager = require('famous/core/OptionsManager');
    var Transform = require('famous/core/Transform');
    var Utility = require('famous/utilities/Utility');
    var ViewSequence = require('famous/core/ViewSequence');
    var EventHandler = require('famous/core/EventHandler');

    /**
     * LimitedScrollview lays out a collection of renderables, and will browse through them based on 
     * accesed position. LimitedScrollview also broadcasts an 'edgeHit' event, with a position property of the location of the edge,
     * when you've hit the 'edges' of it's renderable collection.
     * @class LimitedScrollview
     * @constructor
      * @event error
     * @param {Options} [options] An object of configurable options.
     * @param {Number} [options.direction=Utility.Direction.Y] Using the direction helper found in the famous Utility
     * module, this option will lay out the LimitedScrollview instance's renderables either horizontally
     * (x) or vertically (y). Utility's direction is essentially either zero (X) or one (Y), so feel free
     * to just use integers as well.
     * @param {Number} [clipSize=undefined] The size of the area (in pixels) that LimitedScrollview will display content in.
     * @param {Number} [margin=undefined] The size of the area (in pixels) that LimitedScrollview will process renderables' associated calculations in.
     */
    function LimitedScrollview(options) {
        this.options = Object.create(this.constructor.DEFAULT_OPTIONS);
        this._optionsManager = new OptionsManager(this.options);
        if (options) this._optionsManager.setOptions(options);

        this._items = null;
        this._currentItemIndex = 0;
        this._position = 0;

        // used for shifting nodes
        this._positionOffset = 0;

        this._positionGetter = null;
        this._outputFunction = null;
        this._masterOutputFunction = null;
        this.outputFrom();

        this._onEdge = 0; // -1 for top, 1 for bottom

        this.group = new Group();
        this.group.add({render: _innerRender.bind(this)});

        this._entityId = Entity.register(this);
        this._size = [undefined, undefined];
        this._contextSize = [undefined, undefined];

        this._eventInput = new EventHandler();
        this._eventOutput = new EventHandler();

        EventHandler.setInputHandler(this, this._eventInput);
        EventHandler.setOutputHandler(this, this._eventOutput);
    }

    LimitedScrollview.DEFAULT_OPTIONS = {
        direction: Utility.Direction.Y,
        margin: 0,
        clipSize: undefined
    };

    function _sizeForDir(size) {
        if (!size) size = this._contextSize;
        var dimension = (this.options.direction === Utility.Direction.X) ? 0 : 1;
        return (size[dimension] === undefined) ? this._contextSize[dimension] : size[dimension];
    }

    function _output(node, offset, target) {
        var size = node.getSize ? node.getSize() : this._contextSize;
        var transform = this._outputFunction(offset);
        target.push({transform: transform, target: node.render()});
        return _sizeForDir.call(this, size);
    }

    function _getClipSize() {
        if (this.options.clipSize) return this.options.clipSize;
        else return _sizeForDir.call(this, this._contextSize);
    }

    /**
     * Patches the LimitedScrollview instance's options with the passed-in ones.
     * @method setOptions
     * @param {Options} options An object of configurable options for the LimitedScrollview instance.
     */
    LimitedScrollview.prototype.setOptions = function setOptions(options) {
        return this._optionsManager.setOptions(options);
    };

    /**
     * Tells you if the LimitedScrollview instance is on an edge.
     * @method onEdge
     * @return {Boolean} Whether the LimitedScrollview instance is on an edge or not.
     */
    LimitedScrollview.prototype.onEdge = function onEdge() {
        return this._onEdge;
    };

    /**
     * Allows you to overwrite the way LimitedScrollview lays out it's renderables. LimitedScrollview will
     * pass an offset into the function. By default the LimitedScrollview instance just translates each node
     * in it's direction by the passed-in offset.
     * LimitedScrollview will translate each renderable down 
     * @method outputFrom
     * @param {Function} fn A function that takes an offset and returns a transform.
     * @param {Function} [masterFn]
     */
    LimitedScrollview.prototype.outputFrom = function outputFrom(fn, masterFn) {
        if (!fn) {
            fn = function(offset) {
                return (this.options.direction === Utility.Direction.X) ? Transform.translate(offset, 0) : Transform.translate(0, offset);
            }.bind(this);
            if (!masterFn) masterFn = fn;
        }
        this._outputFunction = fn;
        this._masterOutputFunction = masterFn ? masterFn : function(offset) {
            return Transform.inverse(fn(-offset));
        };
    };

    /**
     * The LimitedScrollview instance's method for reading from an external position. LimitedScrollview uses
     * the external position to actually scroll through it's renderables.
     * @method positionFrom
     * @param {Getter} position Can be either a function that returns a position,
     * or an object with a get method that returns a position.
     */
    LimitedScrollview.prototype.positionFrom = function positionFrom(position) {
        if (position instanceof Function) this._positionGetter = position;
        else if (position && position.get) this._positionGetter = position.get.bind(position);
        else {
            this._positionGetter = null;
            this._position = position;
        }
        if (this._positionGetter) this._position = this._positionGetter.call(this);
    };

    /**
     * Sets the collection of renderables under the LimitedScrollview instance's control.
     *
     * @method sequenceFrom
     * @param {Array|ViewSequence} items Either an array of renderables or a Famous viewSequence.
     * @chainable
     */
    LimitedScrollview.prototype.setItems = function setItems(items) {
        this._items = items;
    };

    /**
     * Returns the width and the height of the LimitedScrollview instance.
     *
     * @method getSize
     * @return {Array} A two value array of the LimitedScrollview instance's current width and height (in that order).
     */
    LimitedScrollview.prototype.getSize = function getSize(actual) {
        return actual ? this._contextSize : this._size;
    };

    /**
     * Generate a render spec from the contents of this component.
     *
     * @private
     * @method render
     * @return {number} Render spec for this component
     */
    LimitedScrollview.prototype.render = function render() {
        if (this._positionGetter) this._position = this._positionGetter.call(this);
        return this._entityId;
    };

    /**
     * Apply changes from this component to the corresponding document element.
     * This includes changes to classes, styles, size, content, opacity, origin,
     * and matrix transforms.
     *
     * @private
     * @method commit
     * @param {Context} context commit context
     */
    LimitedScrollview.prototype.commit = function commit(context) {
        var transform = context.transform;
        var opacity = context.opacity;
        var origin = context.origin;
        var size = context.size;

        // reset edge detection on size change
        if (!this.options.clipSize && (size[0] !== this._contextSize[0] || size[1] !== this._contextSize[1])) {
            this._onEdge = 0;
            this._contextSize = size;

            if (this.options.direction === Utility.Direction.X) {
                this._size[0] = _getClipSize.call(this);
                this._size[1] = undefined;
            }
            else {
                this._size[0] = undefined;
                this._size[1] = _getClipSize.call(this);
            }
        }

        var scrollTransform = this._masterOutputFunction(-this._position);

        return {
            transform: Transform.multiply(transform, scrollTransform),
            opacity: opacity,
            origin: origin,
            target: this.group.render()
        };
    };

    function _normalizeState() {
        var itemSize = _sizeForDir.call(this, this._items[this._currentItemIndex].getSize());
        var nextItemIndex = this._currentItemIndex + 1;
        while (this._items[nextItemIndex] && this._position + this._positionOffset >= itemSize) {
            this._positionOffset -= nodeSize;
            this._currentItemIndex = nextItemIndex;
            itemSize = _sizeForDir.call(this, this._items[this._currentItemIndex].getSize());
            nextItemIndex++;
        }
        var previousItemIndex = this._currentItemIndex - 1;
        while (this._items[previousItemIndex] && this._position + this._positionOffset < 0) {
            var previousItemSize = _sizeForDir.call(this, this._items[previousItemIndex].getSize());
            this._positionOffset += previousItemSize;
            this._currentItemIndex = previousItemIndex;
            previousItemIndex--;
        }
    }

    function _innerRender() {
        var size = null;
        var position = this._position;
        var result = [];

        this._onEdge = 0;

        var offset = -this._positionOffset;
        var clipSize = _getClipSize.call(this);
        var currentIndex = this._currentItemIndex;
        while (this._items[currentIndex] && offset - position < clipSize + this.options.margin) {
            offset += _output.call(this, this._items[currentIndex], offset, result);
            currentIndex++;
        }

        if (!this._items[currentIndex] && offset - position <= clipSize) {
            this._onEdge = 1;
            this._eventOutput.emit('edgeHit', {
                position: offset - clipSize
            });
        }
        else if (!this._items[this._currentItemIndex - 1] && position <= 0) {
            this._onEdge = -1;
            this._eventOutput.emit('edgeHit', {
                position: 0
            });
        }

        // backwards
        currentIndex = this._currentItemIndex - 1;
        offset = -this._positionOffset;
        if (this._items[currentIndex]) {
            size = this._items[currentIndex].getSize ? this._items[currentIndex].getSize() : this._contextSize;
            offset -= _sizeForDir.call(this, size);
        }

        while (this._items[currentIndex] && ((offset - position) > -(_getClipSize.call(this) + this.options.margin))) {
            _output.call(this, this._items[currentIndex], offset, result);
            currentIndex--;
            if (this._items[currentIndex]) {
                size = this._items[currentIndex].getSize ? this._items[currentIndex].getSize() : this._contextSize;
                offset -= _sizeForDir.call(this, size);
            }
        }

        _normalizeState.call(this);
        return result;
    }

    module.exports = LimitedScrollview;
});
