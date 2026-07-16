// /JS/core/store.js
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subs = new Set();

  function get() { return state; }
  function set(patch) {
    state = { ...state, ...patch };
    subs.forEach(fn => {
      try { fn(state); } catch (e) { console.error("[store] subscriber error", e); }
    });
  }
  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  return { get, set, subscribe };
}
