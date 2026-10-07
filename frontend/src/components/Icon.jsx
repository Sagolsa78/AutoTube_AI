import React from 'react';
import * as LucideIcons from 'lucide-react';

const CustomIcons = {
  tiktok: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.28 6.28 0 005.4 15.63a6.28 6.28 0 006.28 6.28 6.28 6.28 0 006.28-6.28V8.42a8.21 8.21 0 003.63 1.63v-3.41a4.85 4.85 0 01-2-1V6.69z" />
    </svg>
  ),
  google: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.35 11.1H12.18v3.66h5.31c-.55 2.5-2.73 4.31-5.31 4.31-3.08 0-5.59-2.5-5.59-5.59S9.1 7.89 12.18 7.89c1.43 0 2.73.55 3.73 1.45L18.5 6.75C16.82 5.16 14.62 4.23 12.18 4.23 7.88 4.23 4.41 7.7 4.41 12s3.47 7.77 7.77 7.77c4.48 0 7.45-3.15 7.45-7.59 0-.55-.06-1.07-.28-1.08z" />
    </svg>
  ),
  instagram: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.905a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.88-.001z"/>
    </svg>
  ),
  facebook: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22.675 0h-21.35C.597 0 0 .597 0 1.325v21.351C0 23.403.597 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.597 1.323-1.324V1.325C24 .597 23.403 0 22.675 0z" />
    </svg>
  ),
  youtube: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
};

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
    'zap': 'Zap',
    'check-circle': 'CheckCircle',
    'list-ordered': 'ListOrdered',
    'globe': 'Globe',
    'bar-chart-3': 'BarChart3',
    'tv': 'Tv',
    'credit-card': 'CreditCard'
  };

  pascalName = mapping[name] || mapping[pascalName] || pascalName;

  if (CustomIcons[name]) {
    const CustomIcon = CustomIcons[name];
    return <CustomIcon width={size} height={size} className={className} />;
  }

  const IconComponent = LucideIcons[pascalName];

  if (!IconComponent) {
    console.error(`Icon not found in Lucide or Custom dictionary: "${name}" (PascalCase: "${pascalName}")`);
    const FallbackIcon = LucideIcons.HelpCircle;
    return <FallbackIcon size={size} className={className} strokeWidth={1.8} />;
  }

  return <IconComponent size={size} className={className} strokeWidth={1.8} />;
}
