export const navConfig = [
  {
    id: 'create',
    label: 'CREATE',
    items: [
      { id: 'dashboard', label: 'Home', icon: 'home', path: '/app', matchMode: 'exact' },
      { id: 'ideas', label: 'Ideas', icon: 'lightbulb', path: '/app/ideas', matchMode: 'prefix' },
      { id: 'scripts', label: 'Scripts', icon: 'file-text', path: '/app/scripts', matchMode: 'prefix' },
      { id: 'library', label: 'Library', icon: 'folder', path: '/app/library', matchMode: 'prefix' }
    ]
  },
  {
    id: 'publish',
    label: 'PUBLISH',
    items: [
      { id: 'calendar', label: 'Calendar', icon: 'calendar', path: '/app/calendar', matchMode: 'prefix' },
      { id: 'queue', label: 'Queue', icon: 'list', path: '/app/queue', matchMode: 'prefix' },
      { id: 'publications', label: 'Publications', icon: 'share-2', path: '/app/publications', matchMode: 'prefix' }
    ]
  },
  {
    id: 'insights',
    label: 'INSIGHTS',
    items: [
      { id: 'analytics', label: 'Analytics', icon: 'bar-chart-2', path: '/app/analytics', matchMode: 'prefix' }
    ]
  },
  {
    id: 'system',
    label: 'SYSTEM',
    items: [
      { id: 'channels', label: 'Channels', icon: 'tv', path: '/app/channels', matchMode: 'prefix' },
      { id: 'settings', label: 'Settings', icon: 'settings', path: '/app/settings', matchMode: 'prefix' },
      { id: 'usage', label: 'Usage', icon: 'activity', path: '/app/usage', matchMode: 'prefix' }
    ]
  }
];

export function getActiveNavItem(pathname, search) {
  let bestMatch = null;

  for (const section of navConfig) {
    for (const item of section.items) {
      const isExact = item.matchMode === 'exact' && pathname === item.path && !search;
      const isPrefix = item.matchMode === 'prefix' && pathname.startsWith(item.path);
      const isQuery = item.matchMode === 'query' && pathname === item.path && search.includes(item.query?.replace('?', ''));

      if (isExact || isPrefix || isQuery) {
        // query matches are more specific than exact matches on the same path
        if (!bestMatch || (isQuery && bestMatch.matchMode !== 'query')) {
          bestMatch = item;
        }
      }
    }
  }

  // fallback for create, etc
  if (!bestMatch) {
     if (pathname.startsWith('/app/create')) {
         return { id: 'create', label: 'Create Short', icon: 'plus', path: '/app/create' };
     }
  }

  return bestMatch;
}
