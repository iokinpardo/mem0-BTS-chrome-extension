import browser from 'webextension-polyfill';

type ChromeLike = typeof chrome;

function resolveChromeApi(): ChromeLike {
  if (typeof globalThis.chrome !== 'undefined') {
    return globalThis.chrome;
  }
  if (typeof globalThis.browser !== 'undefined') {
    return globalThis.browser as unknown as ChromeLike;
  }
  return browser as unknown as ChromeLike;
}

const chromeApi = resolveChromeApi();

if (typeof globalThis.chrome === 'undefined') {
  (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome = chromeApi;
}

export { browser, chromeApi };
