# Financial Report Analyzer - Design Guidelines

## Design Approach
**Material Design System** - Optimized for data-heavy applications with clear hierarchy and structured content presentation. This system excels at displaying complex financial information while maintaining professional aesthetics.

## Layout System
**Spacing**: Use Tailwind units of 3, 4, 6, and 8 consistently (p-4, gap-6, mb-8, etc.)
**Containers**: max-w-7xl for main content, max-w-4xl for focused data views
**Grid**: 12-column responsive grid for flexible data layouts

## Typography Hierarchy
- **Primary Font**: Inter (Google Fonts) - weights 400, 500, 600, 700
- **Monospace Font**: JetBrains Mono - for numerical data display
- **Headings**: text-2xl to text-4xl, font-semibold, tracking-tight
- **Body**: text-base, leading-relaxed
- **Data Labels**: text-sm, font-medium, uppercase tracking-wide
- **Numbers**: Monospace font, text-lg for key metrics, tabular-nums for alignment

## Core Components

### Hero Section (Compact, Data-Focused)
- Height: 40vh maximum - establishes context without dominating
- Split layout: Left 60% for headline/upload interface, Right 40% for contextual image
- Headline typography: text-4xl, font-bold, emphasizing "Financial Clarity"
- Primary CTA: Upload button with file drag-drop zone, elevated with shadow
- Background: Subtle gradient with abstract financial chart visualization image (graphs, data patterns)

### Upload/Input Zone
- Prominent file upload card: Large drop zone with dashed border, centered icon
- Accepted formats displayed: "PDF, Excel, CSV"
- Progress indicator: Linear progress bar with percentage
- Secondary action: Sample report link for testing

### Data Display Tables
- **Table Structure**: Full-width responsive tables with sticky headers
- **Row styling**: Alternating subtle backgrounds (zebra striping)
- **Headers**: Bold, uppercase text-xs, background with light fill
- **Cells**: Padding p-4, text alignment (left for labels, right for numbers)
- **Borders**: Minimal hairline separators between rows
- **Hover states**: Subtle row highlighting for interactivity

### Asset Allocation Cards
- Grid layout: 2 columns on desktop, stack on mobile (grid-cols-1 md:grid-cols-2)
- Card elevation: Subtle shadow with border
- Card content: Icon + Category + Percentage + Amount in structured layout
- Visual indicators: Small colored bars showing allocation percentage
- Total summary card: Highlighted with stronger border

### Navigation
- Top bar: Fixed position, backdrop-blur background
- Logo left, utility actions right (Export, Settings)
- Breadcrumb trail below for multi-step analysis flows

### Action Buttons
- Primary: Solid fill, medium size (px-6 py-3)
- Secondary: Outlined style with border
- Icon buttons: Square aspect ratio, minimal padding
- Export/Download: Prominent placement, icon + text

### Data Visualization Placeholders
- Chart containers: aspect-video ratio
- Placeholder comments for libraries: <!-- CHART: Pie chart for asset allocation using Chart.js -->
- Legends: Positioned right or bottom depending on chart type

## Component Organization

**Page Structure**:
1. Navigation bar (h-16)
2. Hero/Upload section (40vh)
3. Analysis results container (min-h-screen)
4. Data tables section with section headers
5. Asset allocation cards grid
6. Export/action footer

## Icons
**Library**: Heroicons (via CDN)
- Upload: cloud-arrow-up
- Export: arrow-down-tray
- Charts: chart-bar, chart-pie
- Success states: check-circle
- Info: information-circle

## Images

**Hero Background Image**:
- Abstract financial dashboard visualization with charts, graphs, and data points
- Professional stock photo style with blue/grey tones
- Positioned right 40% of hero, subtle overlay for text readability
- Purpose: Establishes professional context without overwhelming data focus

**No additional images needed** - maintain data-first approach throughout application

## Accessibility
- High contrast ratios for all text on backgrounds (WCAG AA minimum)
- Form labels clearly associated with inputs
- Table headers properly marked with scope attributes
- Keyboard navigation for all interactive elements
- Loading states announced for screen readers

## Key Design Principles
1. **Data First**: Information hierarchy prioritizes numerical data and insights
2. **Professional Restraint**: Minimal decoration, maximum clarity
3. **Scannable Layouts**: Strategic whitespace and alignment for quick data parsing
4. **Responsive Tables**: Horizontal scroll on mobile with sticky first column
5. **Progressive Disclosure**: Summary cards leading to detailed tables