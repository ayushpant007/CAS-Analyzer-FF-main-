import { reports, users, gmailConnections, uploadLogs, type Report, type InsertReport, type User, type InsertUser, type GmailConnection, type InsertGmailConnection } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export const DAILY_UPLOAD_LIMIT = 10;

export interface IStorage {
  createReport(report: InsertReport): Promise<Report>;
  upsertReportByInvestorName(report: InsertReport, investorName: string): Promise<Report>;
  getReport(id: number): Promise<Report | undefined>;
  getAllReports(): Promise<Report[]>;
  getReportsByEmail(email: string): Promise<Report[]>;
  getReportByFilename(filename: string): Promise<Report | undefined>;
  getDailyUploadCount(userEmail: string): Promise<number>;
  logUpload(userEmail: string): Promise<void>;
  deleteReport(id: number, userEmail?: string): Promise<boolean>;
  deleteNonCasReports(userEmail?: string): Promise<number>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  updateUserPassword(email: string, passwordHash: string): Promise<void>;
  getGmailConnection(userEmail: string): Promise<GmailConnection | undefined>;
  upsertGmailConnection(conn: InsertGmailConnection): Promise<GmailConnection>;
  getAllGmailConnections(): Promise<GmailConnection[]>;
  deleteGmailConnection(userEmail: string): Promise<void>;
  updateGmailTokens(userEmail: string, accessToken: string, expiresAt: Date): Promise<void>;
  updateGmailLastChecked(userEmail: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async upsertReportByInvestorName(report: InsertReport, investorName: string): Promise<Report> {
    const existing = await db.select().from(reports)
      .where(sql`lower(${reports.analysis}->>'investor_name') = lower(${investorName})`)
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(reports)
        .set({ filename: report.filename, investorType: report.investorType, ageGroup: report.ageGroup, userEmail: report.userEmail, analysis: report.analysis, createdAt: new Date() })
        .where(eq(reports.id, existing[0].id))
        .returning();
      return updated;
    }

    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async getAllReports(): Promise<Report[]> {
    return await db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async getReportsByEmail(email: string): Promise<Report[]> {
    return await db.select().from(reports)
      .where(eq(reports.userEmail, email.toLowerCase()))
      .orderBy(desc(reports.createdAt));
  }

  async getReportByFilename(filename: string): Promise<Report | undefined> {
    const [report] = await db.select().from(reports)
      .where(eq(reports.filename, filename))
      .orderBy(desc(reports.createdAt))
      .limit(1);
    return report;
  }

  async getDailyUploadCount(userEmail: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [logRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(uploadLogs)
      .where(and(eq(uploadLogs.userEmail, userEmail.toLowerCase()), gte(uploadLogs.uploadedAt, todayStart)));
    const [reportRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(reports)
      .where(and(eq(reports.userEmail, userEmail.toLowerCase()), gte(reports.createdAt, todayStart)));
    return Math.max(logRow?.count ?? 0, reportRow?.count ?? 0);
  }

  async logUpload(userEmail: string): Promise<void> {
    await db.insert(uploadLogs).values({ userEmail: userEmail.toLowerCase() });
  }

  async deleteReport(id: number, userEmail?: string): Promise<boolean> {
    const conditions = userEmail
      ? and(eq(reports.id, id), eq(reports.userEmail, userEmail.toLowerCase()))
      : eq(reports.id, id);
    const result = await db.delete(reports).where(conditions).returning({ id: reports.id });
    return result.length > 0;
  }

  async deleteNonCasReports(userEmail?: string): Promise<number> {
    // Non-CAS: cas_source is UNKNOWN AND (mf_snapshot is empty/null OR net_asset_value is null/0)
    const emailFilter = userEmail ? sql`lower(${reports.userEmail}) = lower(${userEmail})` : sql`1=1`;
    const result = await db.delete(reports)
      .where(sql`
        (${reports.analysis}->>'cas_source' = 'UNKNOWN' OR ${reports.analysis}->>'cas_source' IS NULL)
        AND (
          jsonb_array_length(COALESCE(${reports.analysis}->'mf_snapshot', '[]'::jsonb)) = 0
          OR (${reports.analysis}->'summary'->>'net_asset_value' IS NULL OR ${reports.analysis}->'summary'->>'net_asset_value' = 'null')
        )
        AND ${emailFilter}
      `)
      .returning({ id: reports.id });
    return result.length;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile.trim()));
    return user;
  }

  async updateUserPassword(email: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.email, email.toLowerCase()));
  }

  async getGmailConnection(userEmail: string): Promise<GmailConnection | undefined> {
    const [conn] = await db.select().from(gmailConnections)
      .where(eq(gmailConnections.userEmail, userEmail.toLowerCase()));
    return conn;
  }

  async upsertGmailConnection(conn: InsertGmailConnection): Promise<GmailConnection> {
    const existing = await this.getGmailConnection(conn.userEmail);
    if (existing) {
      const [updated] = await db.update(gmailConnections)
        .set({ accessToken: conn.accessToken, refreshToken: conn.refreshToken, expiresAt: conn.expiresAt, casPassword: conn.casPassword })
        .where(eq(gmailConnections.userEmail, conn.userEmail.toLowerCase()))
        .returning();
      return updated;
    }
    const [created] = await db.insert(gmailConnections).values({ ...conn, userEmail: conn.userEmail.toLowerCase() }).returning();
    return created;
  }

  async getAllGmailConnections(): Promise<GmailConnection[]> {
    return await db.select().from(gmailConnections);
  }

  async deleteGmailConnection(userEmail: string): Promise<void> {
    await db.delete(gmailConnections).where(eq(gmailConnections.userEmail, userEmail.toLowerCase()));
  }

  async updateGmailTokens(userEmail: string, accessToken: string, expiresAt: Date): Promise<void> {
    await db.update(gmailConnections)
      .set({ accessToken, expiresAt })
      .where(eq(gmailConnections.userEmail, userEmail.toLowerCase()));
  }

  async updateGmailLastChecked(userEmail: string): Promise<void> {
    await db.update(gmailConnections)
      .set({ lastCheckedAt: new Date() })
      .where(eq(gmailConnections.userEmail, userEmail.toLowerCase()));
  }
}

export const storage = new DatabaseStorage();
