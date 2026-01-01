import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const { data: reports, isLoading: isLoadingReports } = useQuery({
    queryKey: ["/api/reports"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiRequest("POST", "/api/analyze", formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Analysis complete", description: "Your CAS has been processed." });
      setFile(null);
      setPassword("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: error.message,
      });
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);
    uploadMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">CAS Analyzer</h1>
        <p className="text-muted-foreground">
          Upload your Consolidated Account Statement PDF for AI-powered portfolio analysis.
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cas-file">CAS PDF File</Label>
                <Input
                  id="cas-file"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                  data-testid="input-cas-file"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">PDF Password (if any)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={uploadMutation.isPending}
                data-testid="button-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Start Analysis"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          {isLoadingReports ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : reports?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground">No analysis reports yet. Upload a statement to get started.</p>
              </CardContent>
            </Card>
          ) : (
            reports?.map((report: any) => (
              <Card key={report.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{report.filename}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-2">Portfolio Summary</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-primary/5 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Net Asset Value</p>
                            <p className="text-xl font-bold">
                              ₹{report.analysis.summary.net_asset_value.toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-primary/5 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Total Cost</p>
                            <p className="text-xl font-bold">
                              ₹{report.analysis.summary.total_cost.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2">Top Holdings</h3>
                        <div className="space-y-2">
                          {report.analysis.holdings.slice(0, 3).map((h: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm p-2 border-b">
                              <span className="truncate mr-2">{h.scheme_name}</span>
                              <span className="font-medium">₹{h.current_value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="h-[300px]">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4" />
                        Asset Allocation
                      </h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.analysis.asset_allocation}
                            dataKey="percentage"
                            nameKey="asset_class"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                          >
                            {report.analysis.asset_allocation.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
