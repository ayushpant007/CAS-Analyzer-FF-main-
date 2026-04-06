import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const gmailConnections = pgTable("gmail_connections", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  casPassword: text("cas_password"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGmailConnectionSchema = createInsertSchema(gmailConnections).omit({ id: true, createdAt: true });
export type GmailConnection = typeof gmailConnections.$inferSelect;
export type InsertGmailConnection = z.infer<typeof insertGmailConnectionSchema>;

export * from "./models/chat";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mobile: text("mobile"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  investorType: text("investor_type"),
  ageGroup: text("age_group"),
  userEmail: text("user_email"),
  analysis: jsonb("analysis").notNull(), // The AI result
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export const uploadLogs = pgTable("upload_logs", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export type UploadLog = typeof uploadLogs.$inferSelect;
