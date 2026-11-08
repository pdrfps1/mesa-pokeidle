'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { syncDarkClass } = require('./theme-sync.js');

function fakeRoot(themeAttr) {
  const classes = new Set();
  return {
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    getAttribute(name) {
      return name === 'data-theme' && themeAttr !== undefined ? themeAttr : null;
    },
  };
}

test('data-theme="mesa" deixa a classe dark', () => {
  const root = fakeRoot('mesa');
  syncDarkClass(root);
  assert.equal(root.classList.contains('dark'), true);
});

test('data-theme="mesa-claro" tira a classe dark', () => {
  const root = fakeRoot('mesa-claro');
  root.classList.toggle('dark', true);
  syncDarkClass(root);
  assert.equal(root.classList.contains('dark'), false);
});

test('sem data-theme vale o escuro', () => {
  const root = fakeRoot(undefined);
  syncDarkClass(root);
  assert.equal(root.classList.contains('dark'), true);
});
