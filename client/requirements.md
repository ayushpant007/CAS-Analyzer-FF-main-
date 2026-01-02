## Packages
recharts | For visualizing portfolio allocation (pie charts, bar charts)
framer-motion | For smooth page transitions and micro-interactions
clsx | For conditional class names (utility)
tailwind-merge | For merging tailwind classes intelligently
lucide-react | For beautiful icons (already in base, but confirming usage)
date-fns | For formatting dates

## Notes
- API Endpoint: POST /api/analyze accepts FormData (file + password)
- API Endpoint: GET /api/reports returns list of past reports
- The analysis result is a JSON blob stored in the database
- Visuals should be premium financial dashboard style
