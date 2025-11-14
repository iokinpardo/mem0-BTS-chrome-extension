import { initContextMenuMemory } from './context-menu-memory';
import { initDirectUrlTracking } from './direct-url-tracker';
import { chromeApi } from './utils/browser-api';
import { type OpenDashboardMessage, SidebarAction } from './types/messages';

const extension = chromeApi;

extension.runtime.onInstalled.addListener(() => {
  extension.storage.sync.set({ memory_enabled: true }, () => {
    console.log('Memory enabled set to true on install/update');
  });
});

extension.runtime.onMessage.addListener((request: OpenDashboardMessage) => {
  if (request.action === SidebarAction.OPEN_DASHBOARD) {
    const baseUrl = extension.runtime.getURL('src/dashboard.html');
    const params = new URLSearchParams();
    if (request.memoryId) {
      params.set('memoryId', request.memoryId);
    }
    if (request.view) {
      params.set('view', request.view);
    }
    const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
    extension.tabs.create({ url });
  }
  return undefined;
});

extension.runtime.onMessage.addListener(
  (request: { action?: string }, sender: chrome.runtime.MessageSender) => {
    if (request.action === SidebarAction.SIDEBAR_SETTINGS) {
      const tabId = sender.tab?.id;
      if (tabId !== null && tabId !== undefined) {
        extension.tabs.sendMessage(tabId, { action: SidebarAction.SIDEBAR_SETTINGS });
      }
    }
    return undefined;
  }
);

initContextMenuMemory();
initDirectUrlTracking();
