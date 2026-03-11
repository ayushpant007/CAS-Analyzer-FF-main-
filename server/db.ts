import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Prefer DATABASE_URL (local/valid connection), fallback to SUPABASE_DATABASE_URL if it's properly formatted
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const connectionString = dbUrl && typeof dbUrl === 'string' && !dbUrl.includes('@@@') 
  ? dbUrl 
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or SUPABASE_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
