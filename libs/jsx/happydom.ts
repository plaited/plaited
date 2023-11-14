import {parseHTML} from 'linkedom';
function JSDOM(html) { return parseHTML(html); }

const { window} = new JSDOM('<h1>Hello LinkeDOM 👋</h1>');

function copyProps(src, target) {
  Object.defineProperties(target, {
    ...Object.getOwnPropertyDescriptors(src),
    ...Object.getOwnPropertyDescriptors(target),
  });
}

global.window = window;
global.document = window.document;
global.navigator = {
  userAgent: 'node.js',
};

copyProps(window, global);