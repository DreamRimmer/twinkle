/**
 * Open the node REPL then `require('./path/to/mb_repl')`
 * Used in QUnit tests.
 */

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
global.window = new JSDOM('', { pretendToBeVisual: true }).window;
global.document = window.document;

global.HTMLFormElement = window.HTMLFormElement;

global.jQuery = require('jquery');

// mw.config data set separately
global.mw = require(__dirname + '/mw_shim.js').mw;
