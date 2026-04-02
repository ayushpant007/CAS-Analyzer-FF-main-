import { reports, users, type Report, type InsertReport, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createReport(report: InsertReport): Promise<Report>;
  getReport(id: number): Promise<Report | undefined>;
  getAllReports(): Promise<Report[]>;
  getReportsByEmail(email: string): Promise<Report[]>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserPassword(email: string, passwordHash: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createReport(report: InsertReport): Promise<Report> {
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
}

export const storage = new DatabaseStorage();
