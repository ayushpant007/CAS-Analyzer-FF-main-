import { reports, type Report, type InsertReport } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createReport(report: InsertReport): Promise<Report>;
  getReport(id: number): Promise<Report | undefined>;
  getAllReports(): Promise<Report[]>;
  updateReport(id: number, report: Partial<InsertReport>): Promise<Report | undefined>;
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
  async updateReport(id: number, update: Partial<InsertReport>): Promise<Report | undefined> {
    const [updatedReport] = await db.update(reports)
      .set(update)
      .where(eq(reports.id, id))
      .returning();
    return updatedReport;
  }
}

export const storage = new DatabaseStorage();
