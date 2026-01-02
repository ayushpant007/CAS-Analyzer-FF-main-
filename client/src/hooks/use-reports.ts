import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type Report } from "@shared/schema";

// Helper for type safety when handling the flexible JSON analysis structure
export interface AnalysisResult {
  summary: string;
  holdings: Array<{ name: string; value: number; type: string }>;
  allocation: Record<string, number>;
  insights: string[];
}

export interface EnhancedReport extends Omit<Report, "analysis"> {
  analysis: AnalysisResult;
}

// GET /api/reports
export function useReports() {
  return useQuery({
    queryKey: [api.reports.list.path],
    queryFn: async () => {
      const res = await fetch(api.reports.list.path);
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      return api.reports.list.responses[200].parse(data) as EnhancedReport[];
    },
  });
}

// GET /api/reports/:id
export function useReport(id: number | null) {
  return useQuery({
    queryKey: [api.reports.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const url = api.reports.get.path.replace(":id", id.toString());
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      return api.reports.get.responses[200].parse(data) as EnhancedReport;
    },
  });
}

// POST /api/analyze
export function useAnalyzeReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ file, password }: { file: File; password?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (password) {
        formData.append("password", password);
      }

      const res = await fetch(api.analyze.path, {
        method: api.analyze.method,
        body: formData,
        // Don't set Content-Type header manually for FormData, browser does it with boundary
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Analysis failed. Please check your file/password.");
      }

      const data = await res.json();
      return api.analyze.responses[200].parse(data) as EnhancedReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
    },
  });
}
