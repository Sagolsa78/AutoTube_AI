#!/bin/bash
cat << 'CSS_EOF' > frontend/src/index.css
@import "tailwindcss";
@config "../tailwind.config.js";

@layer base {
  :root {
    --canvas: #0A0B0D;
    --surface: #111318;
    --elevated: #171A20;
    --border: #262A32;
    --border-hover: #3a3f4a;

    --text-primary: #F3F1EC;
    --text-secondary: #A7ABB4;
    --text-muted: #737984;

    --brand-red: #E6392F;
    --brand-red-hover: #FF5045;
    
    --success: #32C48D;
    --warning: #E8B04B;
    --danger: #E5484D;
    --info: #5C8FE8;

    --font-sans: 'Inter', system-ui, sans-serif;
    --font-mono: 'Geist Mono', monospace;
  }

  body {
    background-color: var(--canvas);
    color: var(--text-primary);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
}

/* Base resets */
*, *::before, *::after { border-color: var(--border); box-sizing: border-box; }
a { text-decoration: none; color: inherit; }
button { background: none; border: none; cursor: pointer; color: inherit; font-family: inherit; }

/* Custom Utilities for legacy support before full refactor */
.app { display: flex; min-height: 100vh; background: var(--canvas); }
.main { flex: 1; display: flex; flex-direction: column; min-height: 100vh; margin-left: 240px; transition: margin 0.3s ease; }
@media (max-width: 768px) { .main { margin-left: 0; padding-bottom: 64px; /* for mobile nav */ } }
.page { padding: 32px; max-width: 1600px; margin: 0 auto; width: 100%; flex: 1; }
@media (max-width: 768px) { .page { padding: 16px; } }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;
  transition: all 0.2s ease;
}
.btn-primary { background: var(--brand-red); color: #fff; }
.btn-primary:hover { background: var(--brand-red-hover); }
.btn-secondary { background: var(--elevated); color: var(--text-primary); border: 1px solid var(--border); }
.btn-secondary:hover { border-color: var(--border-hover); }

.badge {
  display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;
}
.badge-pending { background: rgba(232, 176, 75, 0.1); color: var(--warning); border: 1px solid rgba(232, 176, 75, 0.2); }
.badge-ready { background: rgba(50, 196, 141, 0.1); color: var(--success); border: 1px solid rgba(50, 196, 141, 0.2); }
.badge-failed { background: rgba(229, 72, 77, 0.1); color: var(--danger); border: 1px solid rgba(229, 72, 77, 0.2); }
.badge-rendering { background: rgba(232, 176, 75, 0.1); color: var(--warning); border: 1px solid rgba(232, 176, 75, 0.2); animation: pulse 2s infinite; }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--canvas); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

CSS_EOF
chmod +x update_css.sh
./update_css.sh
