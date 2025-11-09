import { DEFAULT_USER_ID } from './types/api';
import type { MemoriesResponse, Memory } from './types/memory';
import { StorageKey } from './types/storage';
import { getDomainRuleLists } from './utils/domain_rules';

const MEMORIES_ENDPOINT = 'https://api.mem0.ai/v1/memories/';
const API_PAGE_SIZE = 200;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

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
  totalMemories: number;
  categories: string[];
  categoryCounts: Record<string, number>;
  activeCategory: string;
  searchTerm: string;
  highlightMemoryId: string | null;
  pageSize: number;
  currentPage: number;
  selectedMemoryIds: Set<string>;
};

const state: DashboardState = {
  auth: null,
  allMemories: [],
  filteredMemories: [],
  totalMemories: 0,
  categories: [],
  categoryCounts: {},
  activeCategory: 'all',
  searchTerm: '',
  highlightMemoryId: null,
  pageSize: DEFAULT_PAGE_SIZE,
  currentPage: 1,
  selectedMemoryIds: new Set(),
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
  attachPaginationListeners();
  attachSelectionListeners();
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

function attachPaginationListeners(): void {
  const pageSizeSelect = document.getElementById('pageSizeSelect') as HTMLSelectElement | null;
  const previousButton = document.getElementById('prevPage') as HTMLButtonElement | null;
  const nextButton = document.getElementById('nextPage') as HTMLButtonElement | null;

  if (pageSizeSelect) {
    pageSizeSelect.innerHTML = '';
    PAGE_SIZE_OPTIONS.forEach(size => {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = `${size} per page`;
      if (size === state.pageSize) {
        option.selected = true;
      }
      pageSizeSelect.appendChild(option);
    });

    pageSizeSelect.value = String(state.pageSize);

    pageSizeSelect.addEventListener('change', event => {
      const value = parseInt((event.currentTarget as HTMLSelectElement).value, 10);
      state.pageSize = Number.isFinite(value) && value > 0 ? value : DEFAULT_PAGE_SIZE;
      state.currentPage = 1;
      renderMemoryList();
      updateCounts();
    });
  }

  previousButton?.addEventListener('click', () => {
    changePage(state.currentPage - 1);
  });

  nextButton?.addEventListener('click', () => {
    changePage(state.currentPage + 1);
  });
}

function attachSelectionListeners(): void {
  const selectPageButton = document.getElementById('selectPage') as HTMLButtonElement | null;
  const clearSelectionButton = document.getElementById('clearSelection') as HTMLButtonElement | null;
  const deleteSelectedButton = document.getElementById('deleteSelected') as HTMLButtonElement | null;

  selectPageButton?.addEventListener('click', () => {
    const pageMemories = getCurrentPageMemories();
    pageMemories.forEach(memory => {
      if (memory.id) {
        state.selectedMemoryIds.add(memory.id);
      }
    });
    renderMemoryList();
    updateSelectionBar();
  });

  clearSelectionButton?.addEventListener('click', () => {
    state.selectedMemoryIds.clear();
    renderMemoryList();
    updateSelectionBar();
  });

  deleteSelectedButton?.addEventListener('click', () => {
    void handleBulkDelete();
  });
}

function changePage(targetPage: number): void {
  const filteredTotal = state.filteredMemories.length;
  if (filteredTotal === 0) {
    return;
  }
  const totalPages = Math.max(1, Math.ceil(filteredTotal / state.pageSize));
  const clamped = Math.min(Math.max(targetPage, 1), totalPages);
  if (clamped === state.currentPage) {
    return;
  }
  state.currentPage = clamped;
  renderMemoryList();
  updateCounts();
  const list = document.getElementById('memories-view');
  list?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const { memories, total } = await fetchAllMemories(state.auth);
    state.allMemories = memories;
    state.totalMemories = total;
    const categoryMetadata = deriveCategoryMetadata(memories);
    state.categories = categoryMetadata.categories;
    state.categoryCounts = categoryMetadata.counts;
    state.selectedMemoryIds.clear();
    updateCategoryOptions();
    state.currentPage = 1;
    applyFilters();
    if (showBanner) {
      showStatus('Memories updated.', 'success');
    }
  } catch (error) {
    console.error('Failed to load memories', error);
    showStatus('Unable to load memories. Please try again.', 'error');
    state.allMemories = [];
    state.filteredMemories = [];
    state.totalMemories = 0;
    state.selectedMemoryIds.clear();
    renderMemoryList();
    updateCounts();
    updateSelectionBar();
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

async function fetchAllMemories(auth: AuthContext): Promise<{ memories: Memory[]; total: number }> {
  const collected: Memory[] = [];
  let total = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      user_id: auth.userId,
      page: String(page),
      page_size: String(API_PAGE_SIZE),
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
    const results = data.results ?? [];
    collected.push(...results);
    total = data.count ?? collected.length;

    if (!data.next || results.length < API_PAGE_SIZE) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return { memories: collected, total };
}

async function deleteMemory(auth: AuthContext, memoryId: string): Promise<void> {
  const url = new URL(`${MEMORIES_ENDPOINT}${memoryId}/`);
  url.searchParams.set('user_id', auth.userId);
  if (auth.orgId) {
    url.searchParams.set('org_id', auth.orgId);
  }
  if (auth.projectId) {
    url.searchParams.set('project_id', auth.projectId);
  }

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: auth.headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to delete memory (${response.status})`);
  }
}

async function deleteMemories(memoryIds: string[]): Promise<void> {
  const auth = state.auth;
  if (!auth || memoryIds.length === 0) {
    return;
  }

  showStatus(
    memoryIds.length === 1 ? 'Deleting memory…' : `Deleting ${memoryIds.length} memories…`,
    'info'
  );

  try {
    const normalizedIds = memoryIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (normalizedIds.length === 0) {
      showStatus('No memories selected for deletion.', 'info');
      return;
    }
    for (const id of normalizedIds) {
      await deleteMemory(auth, id);
      state.selectedMemoryIds.delete(id);
    }

    if (normalizedIds.length > 0) {
      const deletedSet = new Set(normalizedIds);
      const beforeCount = state.allMemories.length;
      state.allMemories = state.allMemories.filter(memory => {
        if (!memory.id) {
          return true;
        }
        return !deletedSet.has(memory.id);
      });
      const removed = beforeCount - state.allMemories.length;
      if (removed > 0) {
        state.totalMemories = Math.max(0, state.totalMemories - removed);
      }
      const categoryMetadata = deriveCategoryMetadata(state.allMemories);
      state.categories = categoryMetadata.categories;
      state.categoryCounts = categoryMetadata.counts;
      updateCategoryOptions();
      applyFilters({ preservePage: true });
    }

    showStatus(
      normalizedIds.length === 1
        ? 'Memory deleted successfully.'
        : `${normalizedIds.length} memories deleted successfully.`,
      'success'
    );
  } catch (error) {
    console.error('Failed to delete memories', error);
    throw error;
  }
}

function deriveCategoryMetadata(memories: Memory[]): {
  categories: string[];
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  memories.forEach(memory => {
    (memory.categories || []).forEach(cat => {
      const trimmed = cat?.trim();
      if (!trimmed) {
        return;
      }
      counts[trimmed] = (counts[trimmed] ?? 0) + 1;
    });
  });
  const categories = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  return { categories, counts };
}

function updateCategoryOptions(): void {
  const select = document.getElementById('categorySelect') as HTMLSelectElement | null;
  if (!select) {
    return;
  }
  const current = state.categories.includes(state.activeCategory) ? state.activeCategory : 'all';
  state.activeCategory = current;
  select.innerHTML = '<option value="all">All categories</option>';
  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    const count = state.categoryCounts[category] ?? 0;
    option.textContent = count > 0 ? `${category} (${count})` : category;
    if (category === current) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  select.value = current;
}

function applyFilters(options?: { preservePage?: boolean }): void {
  const preservePage = options?.preservePage ?? false;
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
  if (!preservePage) {
    state.currentPage = 1;
  }

  if (state.highlightMemoryId) {
    const index = state.filteredMemories.findIndex(memory => memory.id === state.highlightMemoryId);
    if (index >= 0) {
      state.currentPage = Math.floor(index / state.pageSize) + 1;
    }
  }

  const validIds = new Set(
    state.allMemories
      .map(memory => memory.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  );
  Array.from(state.selectedMemoryIds).forEach(id => {
    if (!validIds.has(id)) {
      state.selectedMemoryIds.delete(id);
    }
  });

  const totalPages = Math.max(1, Math.ceil(state.filteredMemories.length / state.pageSize));
  if (state.filteredMemories.length === 0) {
    state.currentPage = 1;
  } else if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  } else if (state.currentPage < 1) {
    state.currentPage = 1;
  }

  renderMemoryList();
  updateCounts();
  updateSelectionBar();
}

function getCurrentPageMemories(): Memory[] {
  if (state.filteredMemories.length === 0) {
    return [];
  }
  const startIndex = (state.currentPage - 1) * state.pageSize;
  return state.filteredMemories.slice(startIndex, startIndex + state.pageSize);
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

  const pageMemories = getCurrentPageMemories();

  pageMemories.forEach(memory => {
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

    const primaryRow = document.createElement('div');
    primaryRow.className = 'memory-main';

    if (memory.id) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'memory-select';
      checkbox.checked = state.selectedMemoryIds.has(memory.id);
      checkbox.addEventListener('change', event => {
        const checked = (event.currentTarget as HTMLInputElement).checked;
        toggleMemorySelection(memory.id ?? '', checked);
      });
      primaryRow.appendChild(checkbox);
    }

    primaryRow.appendChild(memoryText);
    card.appendChild(primaryRow);

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

  updateSelectionBar();
}

function updateCounts(): void {
  const countDisplay = document.getElementById('memoryCountDisplay');
  const pageDisplay = document.getElementById('pageDisplay');
  const previousButton = document.getElementById('prevPage') as HTMLButtonElement | null;
  const nextButton = document.getElementById('nextPage') as HTMLButtonElement | null;

  if (!countDisplay || !pageDisplay) {
    return;
  }

  const filteredTotal = state.filteredMemories.length;
  const overallTotal = state.totalMemories || state.allMemories.length;
  const totalPages = filteredTotal > 0 ? Math.ceil(filteredTotal / state.pageSize) : 1;
  const currentPage = filteredTotal > 0 ? state.currentPage : 1;
  const start = filteredTotal === 0 ? 0 : (state.currentPage - 1) * state.pageSize + 1;
  const end = filteredTotal === 0 ? 0 : Math.min(start + state.pageSize - 1, filteredTotal);

  if (filteredTotal === 0) {
    countDisplay.textContent = `0 of ${overallTotal}`;
    pageDisplay.textContent = 'Page 0 of 0';
  } else {
    if (filteredTotal === overallTotal) {
      countDisplay.textContent = `${start}–${end} of ${overallTotal}`;
    } else {
      countDisplay.textContent = `${start}–${end} of ${filteredTotal} (total ${overallTotal})`;
    }
    pageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  if (previousButton) {
    previousButton.disabled = filteredTotal === 0 || state.currentPage <= 1;
  }
  if (nextButton) {
    nextButton.disabled = filteredTotal === 0 || state.currentPage >= totalPages;
  }
}

function toggleMemorySelection(memoryId: string, selected: boolean): void {
  if (!memoryId) {
    return;
  }
  if (selected) {
    state.selectedMemoryIds.add(memoryId);
  } else {
    state.selectedMemoryIds.delete(memoryId);
  }
  updateSelectionBar();
}

function updateSelectionBar(): void {
  const selectedCount = state.selectedMemoryIds.size;
  const selectionSummary = document.getElementById('selectionSummary');
  const selectedCountElement = document.getElementById('selectedCount');
  const deleteSelectedButton = document.getElementById('deleteSelected') as HTMLButtonElement | null;
  const clearSelectionButton = document.getElementById('clearSelection') as HTMLButtonElement | null;
  const selectPageButton = document.getElementById('selectPage') as HTMLButtonElement | null;
  const selectionBar = document.getElementById('selectionBar');

  if (selectedCountElement) {
    selectedCountElement.textContent = String(selectedCount);
  }
  if (selectionSummary) {
    selectionSummary.textContent =
      selectedCount === 0
        ? 'No memories selected'
        : `${selectedCount} ${selectedCount === 1 ? 'memory' : 'memories'} selected`;
  }

  const pageMemories = getCurrentPageMemories();
  const hasPageMemories = pageMemories.length > 0;
  const allSelectedOnPage = hasPageMemories
    ? pageMemories.every(memory => memory.id && state.selectedMemoryIds.has(memory.id))
    : false;

  if (selectPageButton) {
    selectPageButton.disabled = !hasPageMemories || allSelectedOnPage;
    selectPageButton.textContent = hasPageMemories
      ? allSelectedOnPage
        ? 'All on page selected'
        : `Select page (${pageMemories.length})`
      : 'Select page';
  }

  if (clearSelectionButton) {
    clearSelectionButton.disabled = selectedCount === 0;
  }
  if (deleteSelectedButton) {
    deleteSelectedButton.disabled = selectedCount === 0;
  }
  if (selectionBar) {
    selectionBar.dataset.active = selectedCount > 0 ? 'true' : 'false';
  }
}

async function handleDeleteMemory(memoryId: string, button: HTMLButtonElement): Promise<void> {
  if (!memoryId || !state.auth) {
    return;
  }
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Deleting…';
  try {
    await deleteMemories([memoryId]);
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

async function handleBulkDelete(): Promise<void> {
  if (!state.auth || state.selectedMemoryIds.size === 0) {
    return;
  }
  const ids = Array.from(state.selectedMemoryIds);
  const confirmed = window.confirm(
    ids.length === 1
      ? 'Delete the selected memory from BTS Me-mory?'
      : `Delete ${ids.length} selected memories from BTS Me-mory?`
  );
  if (!confirmed) {
    return;
  }
  const deleteSelectedButton = document.getElementById('deleteSelected') as HTMLButtonElement | null;
  if (deleteSelectedButton) {
    deleteSelectedButton.disabled = true;
    deleteSelectedButton.textContent = 'Deleting…';
  }
  try {
    await deleteMemories(ids);
  } catch (error) {
    console.error('Failed to delete selected memories', error);
    showStatus('Failed to delete one or more memories. Please try again.', 'error');
  } finally {
    if (deleteSelectedButton) {
      deleteSelectedButton.textContent = 'Delete selected';
      deleteSelectedButton.disabled = state.selectedMemoryIds.size === 0;
    }
  }
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
