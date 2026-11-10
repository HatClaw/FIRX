import { navItems } from '@/config/nav';

export type Shortcut = (typeof navItems)[number];

const DEFAULT_HREFS = ['/clientes', '/contratos', '/financeiro', '/agenda'];

export function getDefaultShortcutHrefs() {
  return navItems.filter((item) => DEFAULT_HREFS.includes(item.href)).map((item) => item.href);
}

export function normalizeShortcutHrefs(value: unknown) {
  if (!Array.isArray(value)) return getDefaultShortcutHrefs();
  const allowed = new Set(navItems.map((item) => item.href));
  const unique = [...new Set(value.filter((href): href is string => typeof href === 'string' && allowed.has(href)))];
  return unique.length ? unique : getDefaultShortcutHrefs();
}

export function moveShortcut(hrefs: string[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= hrefs.length || to >= hrefs.length || from === to) return hrefs;
  const reordered = [...hrefs];
  const [item] = reordered.splice(from, 1);
  reordered.splice(to, 0, item);
  return reordered;
}
