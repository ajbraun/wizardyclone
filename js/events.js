"use strict";
// Global event bus. Every meaningful game verb emits here; skills and
// achievements (phases 2-3) subscribe. Payloads must be plain data + char/def refs.
const Events = (() => {
  const handlers = {};
  const anyHandlers = [];
  function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
  function onAny(fn) { anyHandlers.push(fn); }
  function emit(type, payload) {
    payload = payload || {};
    const hs = handlers[type];
    if (hs) for (const fn of hs) fn(payload, type);
    for (const fn of anyHandlers) fn(type, payload);
  }
  return { on, onAny, emit };
})();
