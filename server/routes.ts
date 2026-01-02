import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import multer from "multer";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { promisify } from "util";
import { openai } from "./replit_integrations/image/client";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerImageRoutes } from "./replit_integrations/image/routes";

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);

  app.post(api.analyze.path, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const password = req.body.password;
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}.pdf`);

    try {
      await fs.writeFile(tempPath, req.file.buffer);

      // Parse PDF
      let text = "";
      try {
        const { stdout } = await execAsync(`pdftotext -upw "${password}" "${tempPath}" -`);
        text = stdout;
      } catch (e: any) {
        console.error("PDF Parsing error:", e);
        if (e.message.includes("Incorrect password") || (e.stderr && e.stderr.includes("Incorrect password"))) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        // Fallback: sometimes generic error code 3 means bad password in poppler
        // But for now let's assume if it fails it's likely password or corrupt file
        if (e.code === 3 || e.code === 1) { // 3 is "Permissions error", 1 can be generic
             return res.status(401).json({ message: "Incorrect password or file permission error" });
        }
        throw e;
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from PDF. It might be empty or scanned." });
      }

      // Analyze with OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a financial analyst. Analyze the following Consolidated Account Statement (CAS) text. Extract:\n1. Portfolio summary: {\"net_asset_value\": number, \"total_cost\": number}\n2. Account-wise summary table: [{\"type\": string, \"details\": string, \"count\": number, \"value\": number}]\n3. Historical Portfolio Valuation (Consolidated Portfolio Valuation for Year): [{\"month_year\": string, \"valuation\": number, \"change_value\": number, \"change_percentage\": number}]\n4. Asset Class Allocation for the month: [{\"asset_class\": string, \"value\": number, \"percentage\": number}]\n5. Top Holdings: [{\"scheme_name\": string, \"current_value\": number}]\n\nReturn ONLY valid JSON with this exact structure: {\"summary\": {\"net_asset_value\": number, \"total_cost\": number}, \"account_summaries\": [...], \"historical_valuations\": [...], \"asset_allocation\": [...], \"holdings\": [...]}. Ensure all numerical values are numbers. Historical valuations should include the last 12 months if available in text."
          },
          {
            role: "user",
            content: text.slice(0, 50000)
          }
        ],
        response_format: { type: "json_object" }
      });

      const analysisRaw = response.choices[0].message.content || "{}";
      const analysis = JSON.parse(analysisRaw);

      const report = await storage.createReport({
        filename: req.file.originalname,
        analysis
      });

      res.json(report);

    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Analysis failed: " + error.message });
    } finally {
      try {
        await fs.unlink(tempPath);
      } catch (e) { /* ignore */ }
    }
  });

  app.get(api.reports.list.path, async (req, res) => {
    const list = await storage.getAllReports();
    res.json(list);
  });

   app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  return httpServer;
}
