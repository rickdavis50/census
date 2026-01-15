# ZenBusiness BrandOS v1.0 (Census Explorer)

## Principles
- Calm confidence: clear, minimal layouts that feel steady and helpful.
- Zen + Business: grounded visuals with practical clarity.
- Color guides attention; avoid full-bleed gradients.
- Accessibility first: maintain 4:1 contrast or higher.
- Typography: Montserrat for display, Inter for UI/body.

## Tokens (single source of truth)
All tokens live in `src/index.css` and are mapped in `tailwind.config.cjs`.

### Color tokens
| Token | Purpose |
| --- | --- |
| `--zb-bg` | App background (Signature Black) |
| `--zb-surface` | Card surfaces on dark background |
| `--zb-surface-strong` | Stronger surface for headers/zebra rows |
| `--zb-subtle` | Subtle UI fills/callouts |
| `--zb-border` | Low-contrast dividers |
| `--zb-ink` | Primary text on dark |
| `--zb-ink-muted` | Secondary text |
| `--zb-green` | Growth Green (positive/emphasis) |
| `--zb-blue` | Horizon Blue (info/primary) |
| `--zb-moss` | Secondary green for UI states |
| `--zb-ever` | Deeper green for UI states |
| `--zb-gray` | Grayscale neutral (light) |
| `--zb-warm` | Warm Gray backgrounds |
| `--zb-water` | Light blue accent |
| `--zb-leaf` | Light green accent |

### Typography tokens
| Token | Purpose |
| --- | --- |
| `--zb-font-display` | Montserrat display headlines |
| `--zb-font-ui` | Inter for body/UI |

### Radius tokens
| Token | Purpose |
| --- | --- |
| `--zb-radius-sm` | Small controls |
| `--zb-radius-md` | Standard components |
| `--zb-radius-lg` | Cards |

### Shadow tokens
| Token | Purpose |
| --- | --- |
| `--zb-shadow-1` | Subtle elevation |
| `--zb-shadow-2` | Higher elevation |

### Spacing tokens
| Token | Purpose |
| --- | --- |
| `--zb-space-1` to `--zb-space-8` | 4px scale for layout spacing |

### Z-index tokens
| Token | Purpose |
| --- | --- |
| `--zb-z-base` | Default layer |
| `--zb-z-header` | Header layering |
| `--zb-z-overlay` | Modals/overlays |

## Component usage rules
- Use `Card` for all surfaced containers; keep borders subtle.
- Use `Badge` for compact metadata, not alerts.
- Keep buttons minimal; avoid decorative gradients.
- Inputs and selects must use the same radius and focus ring.
- Headers use `font-display`; all dense data uses `font-ui`.

## Chart color rules
### Semantic
- Positive: `--zb-green`
- Info/Primary: `--zb-blue`
- Neutral: `--zb-gray` / `--zb-warm`
- Warning/attention: requires an approved additional token. Do not invent.

### Categorical (multi-series)
- Anchor series: `--zb-blue`, `--zb-green`.
- Extend only with tints/shades of the anchors using opacity/lightness.
- Do not exceed 6 series without labels, patterns, or shapes.

### Sequential (heatmaps)
- “More”: `--zb-leaf` to `--zb-green`
- Neutral intensity: `--zb-warm` to `--zb-gray`

### Diverging
- Below baseline: `--zb-blue`
- Above baseline: `--zb-green`
- Mid-point: `--zb-warm`

### Chart backgrounds
- Prefer Signature Black with gridlines in `--zb-gray` at low opacity.

### Gradients in charts
- Allowed for area fills at low opacity only; never for axis labels or primary text.
