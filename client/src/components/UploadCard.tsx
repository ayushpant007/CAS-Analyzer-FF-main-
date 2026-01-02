import { useState, useRef } from "react";
import { useAnalyzeReport } from "@/hooks/use-reports";
import { Upload, FileText, Lock, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface UploadCardProps {
  onSuccess: (reportId: number) => void;
}

export function UploadCard({ onSuccess }: UploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [investorType, setInvestorType] = useState("Aggressive");
  const [ageGroup, setAgeGroup] = useState("20-35");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { mutate: analyze, isPending, error } = useAnalyzeReport();
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = () => {
    if (!file) return;
    
    analyze(
      { file, password, investorType, ageGroup },
      {
        onSuccess: (data) => {
          toast({
            title: "Analysis Complete",
            description: "Your portfolio has been successfully analyzed.",
          });
          setFile(null);
          setPassword("");
          onSuccess(data.id);
        },
        onError: (err) => {
          toast({
            title: "Analysis Failed",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
        {/* Decorative gradient top bar */}
        <div className="h-2 w-full bg-gradient-to-r from-primary via-blue-400 to-accent" />
        
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-50 rounded-xl text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-slate-900">Upload CAS Statement</h2>
              <p className="text-slate-500 text-sm">Upload your NSDL/CDSL Consolidated Account Statement</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
                  ${isDragOver 
                    ? "border-primary bg-blue-50/50 scale-[1.02]" 
                    : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                  }
                `}
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Click or drag PDF here</h3>
                <p className="text-slate-500 text-sm">Supports .pdf files up to 10MB</p>
                <input 
                  type="file" 
                  accept=".pdf" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="file-details"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-red-500 shadow-sm border border-slate-100 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFile(null)}
                    className="text-slate-400 hover:text-red-500 transition-colors text-sm font-medium px-2 py-1"
                  >
                    Change
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Investor Type</label>
                    <select
                      value={investorType}
                      onChange={(e) => setInvestorType(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white text-sm"
                    >
                      <option value="High Aggressive">High Aggressive</option>
                      <option value="Aggressive">Aggressive</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Conservative">Conservative</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Age Group</label>
                    <select
                      value={ageGroup}
                      onChange={(e) => setAgeGroup(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white text-sm"
                    >
                      <option value="20-35">20-35</option>
                      <option value="35-50">35-50</option>
                      <option value="50-60">50-60</option>
                      <option value="60+">60+</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    PDF Password (if protected)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{error.message}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className={`
                    w-full py-4 rounded-xl font-semibold text-white shadow-lg shadow-primary/25
                    flex items-center justify-center gap-2 transition-all duration-200
                    ${isPending 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-gradient-to-r from-primary to-blue-600 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                    }
                  `}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Portfolio...
                    </>
                  ) : (
                    "Analyze Portfolio"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
