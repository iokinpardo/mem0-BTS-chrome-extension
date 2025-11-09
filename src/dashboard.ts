import { DEFAULT_USER_ID } from './types/api';
import type { MemoriesResponse, Memory } from './types/memory';
import { StorageKey } from './types/storage';
import { getDomainRuleLists } from './utils/domain_rules';

const MEMORIES_ENDPOINT = 'https://api.mem0.ai/v1/memories/';

type AuthContext = {
  headers: Record<string, string>;
  userId: string;
  orgId?: string;
  projectId?: string;
};

type SettingsSnapshot = {
  userId: string;
  orgId?: string;
  projectId?: string;
  similarityThreshold?: number;
  topK?: number;
  trackSearches: boolean;
  enabledDomains: string[];
  disabledDomains: string[];
};

type DashboardState = {
  auth: AuthContext | null;
  allMemories: Memory[];
  filteredMemories: Memory[];
  categories: string[];
  activeCategory: string;
  searchTerm: string;
  highlightMemoryId: string | null;
};

const state: DashboardState = {
  auth: null,
  allMemories: [],
  filteredMemories: [],
  categories: [],
  activeCategory: 'all',
  searchTerm: '',
  highlightMemoryId: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeDashboard().catch(error => {
    console.error('Failed to initialize dashboard', error);
    showStatus('Unexpected error while loading dashboard.', 'error');
  });
});

function initializeTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-button'));
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.target ?? 'memories-view');
    });
  });
}

function activateTab(targetId: string): void {
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.tab-panel'));
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-button'));
  panels.forEach(panel => {
    panel.classList.toggle('active', panel.id === targetId);
  });
  buttons.forEach(button => {
    button.classList.toggle('active', button.dataset.target === targetId);
  });
}

async function initializeDashboard(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');
  if (requestedView === 'settings') {
    activateTab('settings-view');
  }
  state.highlightMemoryId = params.get('memoryId');

  attachFilterListeners();
  attachRefreshListener();

  await loadAuthContext();
  if (!state.auth) {
    showStatus('Sign in through the extension popup to load your memories.', 'error');
    renderMemoryList();
    renderSettingsCards(null);
    return;
  }

  await Promise.all([refreshMemories(), refreshSettings()]);
  showStatus('', '');
}

function attachFilterListeners(): void {
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const categorySelect = document.getElementById('categorySelect') as HTMLSelectElement | null;

  searchInput?.addEventListener('input', event => {
    const value = (event.currentTarget as HTMLInputElement).value || '';
    state.searchTerm = value.toLowerCase();
    applyFilters();
  });

  categorySelect?.addEventListener('change', event => {
    state.activeCategory = (event.currentTarget as HTMLSelectElement).value || 'all';
    applyFilters();
  });
}

function attachRefreshListener(): void {
  const refreshButton = document.getElementById('refreshMemories') as HTMLButtonElement | null;
  refreshButton?.addEventListener('click', async () => {
    if (!state.auth) {
      await loadAuthContext();
    }
    await refreshMemories(true);
  });
}

async function loadAuthContext(): Promise<void> {
  state.auth = await new Promise<AuthContext | null>(resolve => {
    chrome.storage.sync.get(
      [
        StorageKey.API_KEY,
        StorageKey.ACCESS_TOKEN,
        StorageKey.USER_ID,
        StorageKey.SELECTED_ORG,
        StorageKey.SELECTED_PROJECT,
      ],
      data => {
        const apiKey = data[StorageKey.API_KEY];
        const accessToken = data[StorageKey.ACCESS_TOKEN];
        if (!apiKey && !accessToken) {
          resolve(null);
          return;
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        } else {
          headers.Authorization = `Token ${apiKey}`;
        }
        resolve({
          headers,
          userId: data[StorageKey.USER_ID] || DEFAULT_USER_ID,
          orgId: data[StorageKey.SELECTED_ORG] || undefined,
          projectId: data[StorageKey.SELECTED_PROJECT] || undefined,
        });
      }
    );
  });
}

async function refreshMemories(showBanner = false): Promise<void> {
  if (!state.auth) {
    return;
  }
  const refreshButton = document.getElementById('refreshMemories') as HTMLButtonElement | null;
  if (refreshButton) {
    refreshButton.disabled = true;
  }
  if (showBanner) {
    showStatus('Refreshing memories…', 'info');
  }
  try {
    const memories = await fetchMemories(state.auth);
    state.allMemories = memories;
    state.categories = deriveCategories(memories);
    updateCategoryOptions();
    applyFilters();
    if (showBanner) {
      showStatus('Memories updated.', 'success');
    }
  } catch (error) {
    console.error('Failed to load memories', error);
    showStatus('Unable to load memories. Please try again.', 'error');
    state.allMemories = [];
    state.filteredMemories = [];
    renderMemoryList();
    updateCounts();
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
    }
  }
}

async function refreshSettings(): Promise<void> {
  const snapshot = await loadSettingsSnapshot();
  renderSettingsCards(snapshot);
}

async function fetchMemories(auth: AuthContext): Promise<Memory[]> {
  const params = new URLSearchParams({
    user_id: auth.userId,
    page: '1',
    page_size: '100',
  });
  if (auth.orgId) {
    params.append('org_id', auth.orgId);
  }
  if (auth.projectId) {
    params.append('project_id', auth.projectId);
  }
  const response = await fetch(`${MEMORIES_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers: auth.headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch memories (${response.status})`);
  }
  const data = (await response.json()) as MemoriesResponse;
  return data.results ?? [];
}

async function deleteMemory(auth: AuthContext, memoryId: string): Promise<void> {
  const response = await fetch(`${MEMORIES_ENDPOINT}${memoryId}/`, {
    method: 'DELETE',
    headers: auth.headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to delete memory (${response.status})`);
  }
}

function deriveCategories(memories: Memory[]): string[] {
  const set = new Set<string>();
  memories.forEach(memory => {
    (memory.categories || []).forEach(cat => {
      if (cat) {
        set.add(cat);
      }
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function updateCategoryOptions(): void {
  const select = document.getElementById('categorySelect') as HTMLSelectElement | null;
  if (!select) {
    return;
  }
  const current = state.activeCategory;
  select.innerHTML = '<option value="all">All categories</option>';
  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    if (category === current) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function applyFilters(): void {
  const searchTerm = state.searchTerm;
  const category = state.activeCategory;
  state.filteredMemories = state.allMemories.filter(memory => {
    const text = (memory.memory || '').toLowerCase();
    const matchesSearch = searchTerm ? text.includes(searchTerm) : true;
    if (!matchesSearch) {
      return false;
    }
    if (category === 'all') {
      return true;
    }
    const categories = memory.categories || [];
    return categories.some(cat => cat.toLowerCase() === category.toLowerCase());
  });
  renderMemoryList();
  updateCounts();
}

function renderMemoryList(): void {
  const container = document.getElementById('memoryList');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (state.filteredMemories.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.allMemories.length
      ? 'No memories match the current filters.'
      : 'No memories were found for this user.';
    container.appendChild(empty);
    return;
  }

  state.filteredMemories.forEach(memory => {
    const card = document.createElement('article');
    card.className = 'memory-card';
    if (state.highlightMemoryId && memory.id === state.highlightMemoryId) {
      card.classList.add('memory-card--highlight');
      setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
      state.highlightMemoryId = null;
    }

    const memoryText = document.createElement('p');
    memoryText.className = 'memory-text';
    memoryText.innerHTML = escapeHtml(memory.memory || '');
    card.appendChild(memoryText);

    const meta = document.createElement('div');
    meta.className = 'memory-meta';
    const idLabel = document.createElement('span');
    idLabel.textContent = memory.id ? `#${memory.id}` : 'No ID available';
    meta.appendChild(idLabel);
    const createdAt = (memory as { created_at?: string }).created_at;
    if (createdAt) {
      const createdSpan = document.createElement('span');
      createdSpan.textContent = formatTimestamp(createdAt);
      meta.appendChild(createdSpan);
    }
    card.appendChild(meta);

    const categories = memory.categories || [];
    if (categories.length > 0) {
      const categoryRow = document.createElement('div');
      categoryRow.className = 'memory-categories';
      categories.forEach(cat => {
        const badge = document.createElement('span');
        badge.className = 'memory-category';
        badge.textContent = cat;
        categoryRow.appendChild(badge);
      });
      card.appendChild(categoryRow);
    }

    if (state.auth) {
      const actions = document.createElement('div');
      actions.className = 'memory-actions';
      const deleteButton = document.createElement('button');
      deleteButton.className = 'ghost-button';
      deleteButton.type = 'button';
      deleteButton.dataset.id = memory.id || '';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        void handleDeleteMemory(deleteButton.dataset.id || '', deleteButton);
      });
      actions.appendChild(deleteButton);
      card.appendChild(actions);
    }

    container.appendChild(card);
  });
}

function updateCounts(): void {
  const countDisplay = document.getElementById('memoryCountDisplay');
  if (!countDisplay) {
    return;
  }
  const visible = state.filteredMemories.length;
  const total = state.allMemories.length;
  countDisplay.textContent = `${visible} / ${total}`;
}

async function handleDeleteMemory(memoryId: string, button: HTMLButtonElement): Promise<void> {
  if (!memoryId || !state.auth) {
    return;
  }
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Deleting…';
  try {
    await deleteMemory(state.auth, memoryId);
    state.allMemories = state.allMemories.filter(memory => memory.id !== memoryId);
    applyFilters();
    showStatus('Memory deleted successfully.', 'success');
  } catch (error) {
    console.error('Failed to delete memory', error);
    showStatus('Failed to delete the memory. Please try again.', 'error');
    button.disabled = false;
    button.textContent = originalText || 'Delete';
    return;
  }
  button.disabled = false;
  button.textContent = originalText || 'Delete';
}

async function loadSettingsSnapshot(): Promise<SettingsSnapshot | null> {
  const domainRules = await getDomainRuleLists();
  return await new Promise(resolve => {
    chrome.storage.sync.get(
      [
        StorageKey.USER_ID,
        StorageKey.SELECTED_ORG,
        StorageKey.SELECTED_PROJECT,
        StorageKey.SIMILARITY_THRESHOLD,
        StorageKey.TOP_K,
        StorageKey.TRACK_SEARCHES,
      ],
      data => {
        resolve({
          userId: data[StorageKey.USER_ID] || DEFAULT_USER_ID,
          orgId: data[StorageKey.SELECTED_ORG] || undefined,
          projectId: data[StorageKey.SELECTED_PROJECT] || undefined,
          similarityThreshold:
            typeof data[StorageKey.SIMILARITY_THRESHOLD] === 'number'
              ? data[StorageKey.SIMILARITY_THRESHOLD]
              : undefined,
          topK: typeof data[StorageKey.TOP_K] === 'number' ? data[StorageKey.TOP_K] : undefined,
          trackSearches: data[StorageKey.TRACK_SEARCHES] === true,
          enabledDomains: domainRules.enabled,
          disabledDomains: domainRules.disabled,
        });
      }
    );
  });
}

function renderSettingsCards(snapshot: SettingsSnapshot | null): void {
  const container = document.getElementById('settingsCards');
  if (!container) {
    return;
  }
  if (!snapshot) {
    container.innerHTML =
      '<div class="empty-state">Sign in to view the configuration used for your memories.</div>';
    return;
  }
  const identityRows = `
    <dt>User ID</dt>
    <dd>${escapeHtml(snapshot.userId)}</dd>
    <dt>Organization</dt>
    <dd>${snapshot.orgId ? escapeHtml(snapshot.orgId) : '<span class="muted">Not set</span>'}</dd>
    <dt>Project</dt>
    <dd>${snapshot.projectId ? escapeHtml(snapshot.projectId) : '<span class="muted">Not set</span>'}</dd>
  `;
  const retrievalRows = `
    <dt>Similarity threshold</dt>
    <dd>${
      snapshot.similarityThreshold !== undefined
        ? snapshot.similarityThreshold.toFixed(2)
        : '<span class="muted">Default (0.10)</span>'
    }</dd>
    <dt>Top K</dt>
    <dd>${snapshot.topK !== undefined ? snapshot.topK : '<span class="muted">Default (10)</span>'}</dd>
  `;
  const trackingRows = `
    <dt>Track searches</dt>
    <dd>${snapshot.trackSearches ? 'Enabled' : 'Disabled'}</dd>
  `;
  const allowList = snapshot.enabledDomains.length
    ? `<ul class="domain-list">${snapshot.enabledDomains
        .map(domain => `<li>${escapeHtml(domain)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">All domains allowed.</p>';
  const blockList = snapshot.disabledDomains.length
    ? `<ul class="domain-list">${snapshot.disabledDomains
        .map(domain => `<li>${escapeHtml(domain)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">No domains blocked.</p>';

  container.innerHTML = `
    <article class="settings-card">
      <h3>Identity</h3>
      <dl>${identityRows}</dl>
    </article>
    <article class="settings-card">
      <h3>Retrieval</h3>
      <dl>${retrievalRows}</dl>
    </article>
    <article class="settings-card">
      <h3>Tracking</h3>
      <dl>${trackingRows}</dl>
    </article>
    <article class="settings-card">
      <h3>Domain allow list</h3>
      ${allowList}
    </article>
    <article class="settings-card">
      <h3>Domain block list</h3>
      ${blockList}
    </article>
  `;
}

function formatTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return value;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(message: string, variant: 'info' | 'error' | 'success' | ''): void {
  const banner = document.getElementById('status');
  if (!banner) {
    return;
  }
  if (!message) {
    banner.textContent = '';
    banner.removeAttribute('data-variant');
    banner.style.display = 'none';
    return;
  }
  banner.textContent = message;
  banner.dataset.variant = variant;
  banner.style.display = 'block';
}
