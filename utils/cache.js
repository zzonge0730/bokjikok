// utils/cache.js
const cache = new Map();

function set(key, value) {
  cache.set(key, value);
}

function get(key) {
  return cache.get(key);
}

function has(key) {
  return cache.has(key);
}

function clear() {
  cache.clear();
}

module.exports = { set, get, has, clear };
