import { reports, users, gmailConnections, type Report, type InsertReport, type User, type InsertUser, type GmailConnection, type InsertGmailConnection } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  createReport(report: InsertReport): Promise<Report>;
  upsertReportByInvestorName(report: InsertReport, investorName: string): Promise<Report>;
  getReport(id: number): Promise<Report | undefined>;
  getAllReports(): Promise<Report[]>;
  getReportsByEmail(email: string): Promise<Report[]>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
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

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
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
