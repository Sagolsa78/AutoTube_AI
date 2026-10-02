import * as LucideIcons from 'lucide-react';

export default function Icon({ name, size = 16, className = '' }) {
  // Convert kebab-case or camelCase to PascalCase for Lucide
  const toPascalCase = (str) =>
    str.match(/[a-z0-9]+/gi)
      ?.map((word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase())
      .join('') || '';

  let pascalName = toPascalCase(name);
  
  // Custom mapping for legacy names
  const mapping = {
    'fileText': 'FileText',
    'barChart': 'BarChart2',
    'plus-circle': 'PlusCircle',
    'youtube': 'Youtube',
    'star': 'Star',
    'bell': 'Bell',
    'folder': 'Folder',
    'film': 'Film',
    'plus': 'Plus',
    'hash': 'Hash',
    'activity': 'Activity',
    'heart': 'Heart',
    'settings': 'Settings',
    'home': 'Home',
    'lightbulb': 'Lightbulb',
    'video': 'Video',
    'menu': 'Menu',
    'external-link': 'ExternalLink',
    'check': 'Check',
    'x': 'X',
    'loader': 'Loader',
    'save': 'Save',
    'arrow-right': 'ArrowRight',
    'search': 'Search',
    'image': 'Image',
    'sparkles': 'Sparkles',
    'play': 'Play',
    'pause': 'Pause',
    'mic': 'Mic',
    'volume-2': 'Volume2',
    'volume-x': 'VolumeX',
    'maximize': 'Maximize',
    'upload': 'Upload',
    'refresh-cw': 'RefreshCw',
    'alert-triangle': 'AlertTriangle',
    'zap': 'Zap'
  };

  pascalName = mapping[name] || mapping[pascalName] || pascalName;

  const IconComponent = LucideIcons[pascalName] || LucideIcons.HelpCircle;

  return <IconComponent size={size} className={className} strokeWidth={1.8} />;
}
