/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Owner: felix@famo.us
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

define(function (require, exports, module) {
  var Group = require('famous/core/Group');
  var OptionsManager = require('famous/core/OptionsManager');
  var SequentialLayout = require('famous/views/SequentialLayout');
  var Utility = require('famous/utilities/Utility');

  /**
   * NativeScrollview will lay out a collection of renderables sequentially in the specified direction,
   * optionally with the ability of native scrolling.
   * @class NativeScrollview
   * @constructor
   * @param {Options} [options] An object of configurable options.
   * @param {Number} [options.direction=Utility.Direction.Y] Using the direction helper found in the famous Utility
   * module, this option will lay out the NativeScrollview instance's renderables either horizontally
   * (x) or vertically (y). Utility's direction is essentially either zero (X) or one (Y), so feel free
   * to just use integers as well.
   * @param {Array.Number} [options.defaultItemSize=[50, 50]] In the case where a renderable layed out
   * under NativeScrollview's control doesen't have a getSize method, NativeScrollview will assign it
   * this default size. (Commonly a case with Views).
   * @param {Array.Number} [options.length=400] This is the equivalent to CSS maxHeight/Width depeding upon
   * the supplied direction.
   */
  function NativeScrollview(options) {
    this._items = null;
    this._size = null;

    this.options = Object.create(this.constructor.DEFAULT_OPTIONS);

    this.optionsManager = new OptionsManager(this.options);
    if (options) this.setOptions(options);
    this.group = new Group();
    this.sequentialLayout = new SequentialLayout(this.options);

    this.group.add(this.sequentialLayout);

    this.group.setProperties({
      maxHeight: !!this.options.direction && this.options.length + 'px',
      maxWidth: !this.options.direction && this.options.length + 'px',
      overflow:'auto',
      height:!this.options.direction && 'auto',
      width:!!this.options.direction && 'auto'
    });
  }

  NativeScrollview.DEFAULT_OPTIONS = {
    direction: Utility.Direction.Y,
    itemSpacing: 0,
    defaultItemSize:[50, 50],
    length:400
  };


  /**
   * Returns the width and the height of the NativeScrollview instance.
   *
   * @method getSize
   * @return {Array} A two value array of the NativeScrollview instance's current width and height (in that order).
   */
  NativeScrollview.prototype.getSize = function getSize() {
    if (!this._size) this.render(); // hack size in
    return this._size;
  };

  /**
   * Sets the collection of renderables under the NativeScrollview instance's control.
   *
   * @method sequenceFrom
   * @param {Array|ViewSequence} items Either an array of renderables or a Famous viewSequence.
   * @chainable
   */
  NativeScrollview.prototype.sequenceFrom = function sequenceFrom(items) {
    this.sequentialLayout.sequenceFrom(items);
    return this;
  };

  /**
   * Patches the NativeScrollview instance's options with the passed-in ones.
   *
   * @method setOptions
   * @param {Options} options An object of configurable options for the NativeScrollview instance.
   * @chainable
   */
  NativeScrollview.prototype.setOptions = function setOptions(options) {
    this.optionsManager.setOptions.apply(this.optionsManager, arguments);
    return this;
  };

  /**
   * Sets the length of the NativeScrollview instance.
   *
   * @method setLength
   */
  NativeScrollview.prototype.setLength = function setLength(length) {
    this.options.length = length;
    this.group.setProperties({
      maxHeight: !!this.options.direction && this.options.length + 'px',
      maxWidth: !this.options.direction && this.options.length + 'px'
    });
  };

  /**
   * Generate a render spec from the contents of this component.
   *
   * @private
   * @method render
   * @return {number} Render spec for this component
   */
  NativeScrollview.prototype.render = function render() {
    this.sequentialLayout.render();

    this.group.setSize([
        !this.options.direction && this.sequentialLayout.getSize()[0],
      !!this.options.direction && this.sequentialLayout.getSize()[1]
    ]);

    return this.group.render();
  };

  module.exports = NativeScrollview;
});
