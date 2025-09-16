
(function () {
  'use strict';

  // Don't run twice
  if (window.__WorkerTimersInstalled) return;
  window.__WorkerTimersInstalled = true;

  // Create a worker from blob that runs independent timers
  const workerCode = `
    const timers = {};
    self.onmessage = function(e) {
      const d = e.data;
      if (d.cmd === 'setInterval') {
        if (timers[d.id]) clearInterval(timers[d.id]);
        timers[d.id] = setInterval(() => self.postMessage({type:'interval', id:d.id}), d.delay);
      } else if (d.cmd === 'clearInterval') {
        if (timers[d.id]) { clearInterval(timers[d.id]); delete timers[d.id]; }
      } else if (d.cmd === 'setTimeout') {
        if (timers[d.id]) clearTimeout(timers[d.id]);
        timers[d.id] = setTimeout(() => {
          self.postMessage({type:'timeout', id:d.id});
          delete timers[d.id];
        }, d.delay);
      } else if (d.cmd === 'clearTimeout') {
        if (timers[d.id]) { clearTimeout(timers[d.id]); delete timers[d.id]; }
      } else if (d.cmd === 'clearAll') {
        for (const k in timers) {
          clearTimeout(timers[k]);
          clearInterval(timers[k]);
        }
        Object.keys(timers).forEach(k => delete timers[k]);
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const w = new Worker(workerUrl);

  // maps for callbacks
  const callbacks = {};
  let nextId = 1;

  w.onmessage = function (e) {
    const m = e.data;
    if (!m) return;
    const cbWrap = callbacks[m.id];
    if (!cbWrap) return;
    if (m.type === 'interval') {
      try { cbWrap.cb(); } catch (err) { console.error('WorkerTimers interval callback error', err); }
    } else if (m.type === 'timeout') {
      try { cbWrap.cb(); } catch (err) { console.error('WorkerTimers timeout callback error', err); }
      // timeout is single-shot: remove from map (already removed in worker, but we cleanup)
      delete callbacks[m.id];
    }
  };

  // store native functions to fall back
  const _native = {
    setInterval: window.setInterval,
    clearInterval: window.clearInterval,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout
  };

  // override
  function workerSetInterval(cb, delay, ...args) {
    if (typeof cb !== 'function') {
      // support string code as native would (less safe)
      return _native.setInterval(cb, delay, ...args);
    }
    const id = nextId++;
    callbacks[id] = { cb: () => cb(...args) };
    w.postMessage({ cmd: 'setInterval', id, delay: Number(delay) || 0 });
    return id;
  }

  function workerClearInterval(id) {
    if (callbacks[id]) delete callbacks[id];
    w.postMessage({ cmd: 'clearInterval', id });
  }

  function workerSetTimeout(cb, delay, ...args) {
    if (typeof cb !== 'function') {
      return _native.setTimeout(cb, delay, ...args);
    }
    const id = nextId++;
    callbacks[id] = { cb: () => cb(...args) };
    w.postMessage({ cmd: 'setTimeout', id, delay: Number(delay) || 0 });
    return id;
  }

  function workerClearTimeout(id) {
    if (callbacks[id]) delete callbacks[id];
    w.postMessage({ cmd: 'clearTimeout', id });
  }

  // Expose switch: if site needs native timers, can restore easily
  window.WorkerTimers = {
    enable() {
      window.setInterval = workerSetInterval;
      window.clearInterval = workerClearInterval;
      window.setTimeout = workerSetTimeout;
      window.clearTimeout = workerClearTimeout;
    },
    disable() {
      window.setInterval = _native.setInterval;
      window.clearInterval = _native.clearInterval;
      window.setTimeout = _native.setTimeout;
      window.clearTimeout = _native.clearTimeout;
      w.postMessage({ cmd: 'clearAll' });
    },
    _worker: w
  };

  // Activate by default
  window.WorkerTimers.enable();

  // helpful log
  console.info('WorkerTimers installed — page setInterval/setTimeout now backed by Web Worker (less throttled). Use window.WorkerTimers.disable() to restore native timers.');
})();
//use intervals for ever in other scripts or even i consoles