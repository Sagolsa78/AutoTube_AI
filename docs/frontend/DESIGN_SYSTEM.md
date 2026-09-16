# AutoTube AI — Design System & Component Library

## 1. Aesthetic Direction

- **Dark & Cinematic**: Deep canvas backgrounds (`#0A0B0D`) paired with structured surface layers (`#111318`, `#171A20`) and subtle slate borders (`#262A32`).
- **Restrained Brand Red Accent**: `#E6392F` used for key brand anchors and primary call-to-actions, never overused for decorative noise.
- **Typography**:
  - Primary UI & Body: `Manrope` / `Inter`
  - Code / Telemetry / Metrics: `JetBrains Mono`
- **Focus & Accessibility**: Visible ring focus states (`focus-visible:ring-2 ring-brand-red`), full keyboard accessibility for navigation & Command Palette (`Cmd/Ctrl + K`).

---

## 2. Token Palette

| Token | Hex Value | Usage |
|---|---|---|
| `--color-canvas` | `#0A0B0D` | Main app canvas background |
| `--color-surface` | `#111318` | Sidebar, header, base card containers |
| `--color-surface-hover` | `#171A20` | Hover state for surface rows & buttons |
| `--color-elevated` | `#171A20` | Modals, dropdowns, nested cards |
| `--color-border` | `#262A32` | Standard card and separator borders |
| `--color-border-strong` | `#353A45` | Hovered or active item border |
| `--color-brand-red` | `#E6392F` | Primary button, active tab indicator |
| `--color-text-primary` | `#F3F1EC` | High-contrast body & header text |
| `--color-text-secondary`| `#A7ABB4` | Subtitles, labels, secondary metadata |
| `--color-text-muted` | `#737984` | Placeholders, inactive icons, timestamps |
| `--color-success` | `#32C48D` | Completed jobs, positive growth stats |
| `--color-warning` | `#E8B04B` | In-progress render tasks, pending alerts |
| `--color-danger` | `#E5484D` | Failed render jobs, delete actions |

---

## 3. UI Component Catalog

1. **`Button`**: Variants `primary` (red glow), `secondary` (surface bordered), `ghost`, `danger`, `outline`. Sizes `sm`, `md`, `lg`.
2. **`Card`, `CardHeader`, `CardTitle`, `CardContent`**: Clean container with standard rounded-xl, border, and elevated styling.
3. **`StatusBadge`**: Semantic badges for `queued`, `rendering`, `ready`, `approved`, `uploaded`, `failed`, `cancelled`.
4. **`Skeleton`**: Loading placeholders with subtle dark shimmer effect.
5. **`EmptyState`**: Meaningful, actionable guidance when a queue or library is empty.
6. **`CommandPalette`**: Fast keyboard-driven command center for searching actions and views (`Cmd/Ctrl + K`).
7. **`JobCenterDropdown`**: Real-time compute & video progress drawer attached to header.
