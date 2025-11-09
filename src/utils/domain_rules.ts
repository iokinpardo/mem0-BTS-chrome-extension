import { StorageKey } from '../types/storage';

export type DomainRuleLists = {
  enabled: string[];
  disabled: string[];
};

function normalizePattern(pattern: string | undefined | null): string | null {
  if (!pattern) {
    return null;
  }
  const trimmed = pattern
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === '*') {
    return '*';
  }
  return trimmed;
}

function matchesHost(host: string, pattern: string): boolean {
  if (!host || !pattern) {
    return false;
  }
  if (pattern === '*') {
    return true;
  }
  const normalizedHost = host.toLowerCase();
  const normalizedPattern = pattern.replace(/^\*\./, '');
  if (normalizedHost === normalizedPattern) {
    return true;
  }
  return normalizedHost.endsWith(`.${normalizedPattern}`);
}

function parseStoredList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? normalizePattern(item) : null))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/) // support both newline and comma separation
      .map(segment => normalizePattern(segment))
      .filter((segment): segment is string => Boolean(segment));
  }
  return [];
}

export function evaluateHostAgainstRules(
  host: string,
  enabled: string[],
  disabled: string[]
): boolean {
  if (!host) {
    return true;
  }
  const normalizedHost = host.toLowerCase();
  const normalizedDisabled = disabled.map(entry => entry.toLowerCase());
  if (normalizedDisabled.some(pattern => matchesHost(normalizedHost, pattern))) {
    return false;
  }
  const normalizedEnabled = enabled.map(entry => entry.toLowerCase());
  if (normalizedEnabled.length > 0) {
    return normalizedEnabled.some(pattern => matchesHost(normalizedHost, pattern));
  }
  return true;
}

export async function getDomainRuleLists(): Promise<DomainRuleLists> {
  return await new Promise(resolve => {
    try {
      chrome.storage.sync.get([StorageKey.ENABLED_DOMAINS, StorageKey.DISABLED_DOMAINS], result => {
        const enabled = parseStoredList(result[StorageKey.ENABLED_DOMAINS]);
        const disabled = parseStoredList(result[StorageKey.DISABLED_DOMAINS]);
        resolve({ enabled, disabled });
      });
    } catch (error) {
      console.warn('Failed to load domain rules', error);
      resolve({ enabled: [], disabled: [] });
    }
  });
}

export async function isMemoryAllowedForUrl(url: string | null | undefined): Promise<boolean> {
  if (!url) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) {
      return true;
    }
    const { enabled, disabled } = await getDomainRuleLists();
    return evaluateHostAgainstRules(parsed.hostname, enabled, disabled);
  } catch {
    return true;
  }
}
