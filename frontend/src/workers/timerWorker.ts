/// <reference lib="webworker" />
// Drives the Pomodoro tick. Lives in a Worker so background-tab throttling
// doesn't freeze the displayed countdown — important when the tab is being
// captured for screen-share/projector while the user works elsewhere.

declare const self: DedicatedWorkerGlobalScope;

type InMessage =
  | { type: 'start'; interval: number }
  | { type: 'stop' };

let intervalId: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type === 'start') {
    if (intervalId != null) clearInterval(intervalId);
    intervalId = setInterval(() => {
      self.postMessage({ type: 'tick' });
    }, msg.interval);
  } else if (msg.type === 'stop') {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};

export {};
