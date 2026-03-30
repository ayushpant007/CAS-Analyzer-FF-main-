# FinAnalyze - AI Portfolio Analysis Platform

## Overview

FinAnalyze is an AI-powered financial portfolio analysis application. Users upload password-protected PDF statements, and the system extracts text using `pdftotext`, sends it to OpenAI for analysis, and returns structured insights including holdings, allocations, and recommendations. Results are stored in PostgreSQL and displayed through a premium financial dashboard interface with charts and visualizations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Charts**: Recharts for portfolio visualization (pie charts, bar charts)
- **Build Tool**: Vite with hot module replacement

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Custom hooks in `client/src/hooks/`
- Path aliases: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for development
- **API Pattern**: REST endpoints defined in `shared/routes.ts` with Zod validation
- **File Handling**: Multer for multipart form uploads
- **PDF Processing**: External `pdftotext` command (poppler-utils) for text extraction

Key server files:
- `server/index.ts` - Express app setup and middleware
- `server/routes.ts` - API route registration
- `server/storage.ts` - Database abstraction layer
- `server/db.ts` - Drizzle ORM database connection

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Migrations**: `migrations/` directory, managed via `drizzle-kit push`

Main tables:
- `reports` - Stores uploaded file analysis results with JSONB for flexible AI output
- `conversations` / `messages` - Chat history for AI conversations

### AI Integration
- **Provider**: Google Gemini (via Replit AI Integrations or User API Key)
- **Features**: 
  - PDF content analysis for portfolio insights
  - Chat functionality for follow-up questions
- **Configuration**: Uses environment variables `GEMINI_API_KEY_1` and `GEMINI_MODEL` (e.g., `gemini-2.5-flash`). Falls back to `GEMINI_API_KEY_4` if configured.

### Build Process
- **Development**: `npm run dev` runs tsx with Vite middleware
- **Production**: `npm run build` uses esbuild for server bundling and Vite for client
- **Output**: `dist/` contains bundled server (`index.cjs`) and static files (`public/`)

## External Dependencies

### Database
- **PostgreSQL**: Required, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Schema management and queries
- **connect-pg-simple**: Session storage (available but sessions not currently implemented)

### AI Services
- **Gemini API**: Portfolio analysis and chat
- Environment variables: `GEMINI_API_KEY_1`, `GEMINI_MODEL`

### System Dependencies
- **poppler-utils**: Required for `pdftotext` command to parse PDF files

### Key NPM Packages
- `@tanstack/react-query` - Server state management
- `recharts` - Data visualization
- `framer-motion` - Animations
- `date-fns` - Date formatting
- `zod` - Runtime validation
- `multer` - File upload handling
- `drizzle-orm` / `drizzle-zod` - Database ORM and schema validation