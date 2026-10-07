export const navConfig = [
  {
    id: 'primary',
    items: [
      { id: 'home', label: 'Home', icon: 'home', path: '/app', matchMode: 'exact' }
    ]
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { id: 'all-videos', label: 'All', icon: 'folder', path: '/app/videos', matchMode: 'exact' },
      { id: 'ideas', label: 'Ideas', icon: 'lightbulb', path: '/app/ideas', matchMode: 'prefix', badgeKey: 'ideas' },
      { id: 'scripts', label: 'Scripts', icon: 'file-text', path: '/app/scripts', matchMode: 'prefix', badgeKey: 'scripts' },
      { id: 'review', label: 'Review', icon: 'eye', path: '/app/videos', query: '?filter=review', matchMode: 'query', badgeKey: 'review' },
      { id: 'failed', label: 'Failed', icon: 'alert-triangle', path: '/app/videos', query: '?filter=failed', matchMode: 'query', badgeKey: 'failed' },
      { id: 'published', label: 'Published', icon: 'check-circle', path: '/app/videos', query: '?filter=published', matchMode: 'query', badgeKey: 'published' }
    ]
  },
  {
    id: 'publishing',
    label: 'Publishing',
    items: [
      { id: 'calendar', label: 'Calendar', icon: 'calendar', path: '/app/calendar', matchMode: 'prefix' },
      { id: 'queue', label: 'Queue', icon: 'list-ordered', path: '/app/publications', query: '?filter=queue', matchMode: 'query' },
      { id: 'publications', label: 'Publications', icon: 'globe', path: '/app/publications', matchMode: 'exact' }
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', icon: 'bar-chart-3', path: '/app/analytics', matchMode: 'prefix' }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'channels', label: 'Channels', icon: 'tv', path: '/app/channels', matchMode: 'prefix' },
      { id: 'settings', label: 'Settings', icon: 'settings', path: '/app/profile', matchMode: 'prefix' },
      { id: 'plan', label: 'Plan & Usage', icon: 'credit-card', path: '/app/costs', matchMode: 'prefix' }
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
