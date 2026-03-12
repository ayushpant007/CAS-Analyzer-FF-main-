import { useState, useRef } from "react";
import { useAnalyzeReport } from "@/hooks/use-reports";
import { Upload, FileText, Lock, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
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

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-150, 150], [6, -6]);
  const rotateY = useTransform(mouseX, [-150, 150], [-6, 6]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0];
      if (f.type === "application/pdf") {
        setFile(f);
      } else {
        toast({ title: "Invalid file type", description: "Please upload a PDF file.", variant: "destructive" });
      }
    }
  };

  const handleSubmit = () => {
    if (!file) return;
    analyze(
      { file, password, investorType, ageGroup },
      {
        onSuccess: (data) => {
          toast({ title: "Analysis Complete", description: "Your portfolio has been successfully analyzed." });
          setFile(null);
          setPassword("");
          onSuccess(data.id);
        },
        onError: (err) => {
          toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90, scale: 0.8 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 15, duration: 0.8 }}
      style={{ perspective: 1200, transformStyle: "preserve-3d" }}
      className="w-full max-w-xl mx-auto"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="rounded-3xl overflow-hidden relative"
      >
        {/* Animated glow border */}
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 20px 2px rgba(59,111,255,0.3), inset 0 0 20px 2px rgba(59,111,255,0.05)",
              "0 0 40px 6px rgba(147,51,234,0.4), inset 0 0 30px 4px rgba(147,51,234,0.07)",
              "0 0 30px 4px rgba(6,182,212,0.35), inset 0 0 25px 3px rgba(6,182,212,0.06)",
              "0 0 20px 2px rgba(59,111,255,0.3), inset 0 0 20px 2px rgba(59,111,255,0.05)",
            ],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{ zIndex: 10 }}
        />

        {/* Animated gradient border ring */}
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            padding: "1.5px",
            background: "linear-gradient(135deg, #3b6fff, #9333ea, #06b6d4, #3b6fff)",
            backgroundSize: "300% 300%",
            zIndex: 2,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />

        {/* Card body */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: "rgba(10, 15, 40, 0.75)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(96,165,250,0.15)",
          }}
        >
          {/* Animated top bar */}
          <motion.div
            className="h-1.5 w-full"
            animate={{
              background: [
                "linear-gradient(90deg, #3b6fff, #9333ea, #06b6d4)",
                "linear-gradient(90deg, #9333ea, #06b6d4, #3b6fff)",
                "linear-gradient(90deg, #06b6d4, #3b6fff, #9333ea)",
                "linear-gradient(90deg, #3b6fff, #9333ea, #06b6d4)",
              ],
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Floating inner glow */}
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(59,111,255,0.15) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="p-8 relative">
            {/* Header */}
            <motion.div
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              <motion.div
                className="p-3 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(59,111,255,0.2)", color: "#60a5fa" }}
                animate={{ rotate: [0, 5, -5, 0], y: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <FileText className="w-6 h-6" />
              </motion.div>
              <div>
                <h2
                  className="text-xl font-bold font-display"
                  style={{ color: "#e2e8f0" }}
                >
                  Upload CAS Statement
                </h2>
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.7)" }}>
                  Upload your NSDL/CDSL Consolidated Account Statement
                </p>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, rotateX: -90, transformOrigin: "top" }}
                  animate={{ opacity: 1, rotateX: 0 }}
                  exit={{ opacity: 0, rotateX: 90, transformOrigin: "bottom" }}
                  transition={{ type: "spring", stiffness: 100, damping: 18 }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 relative overflow-hidden"
                  style={{
                    borderColor: isDragOver ? "rgba(96,165,250,0.8)" : "rgba(96,165,250,0.25)",
                    background: isDragOver
                      ? "rgba(59,111,255,0.12)"
                      : "rgba(15,25,60,0.4)",
                    transform: isDragOver ? "scale(1.02)" : "scale(1)",
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  {/* Shimmer on hover */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 40%, rgba(96,165,250,0.07) 50%, transparent 60%)",
                      backgroundSize: "200% 100%",
                    }}
                    animate={{ backgroundPosition: ["-200% 0", "200% 0"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  />

                  {/* Upload icon with float */}
                  <motion.div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(59,111,255,0.2)", color: "#60a5fa" }}
                    animate={{ y: [0, -8, 0], rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Upload className="w-8 h-8" />
                  </motion.div>

                  <h3 className="font-semibold mb-1" style={{ color: "#e2e8f0" }}>
                    Click or drag PDF here
                  </h3>
                  <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
                    Supports .pdf files up to 10MB
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="file-details"
                  initial={{ opacity: 0, rotateY: -90, scale: 0.9 }}
                  animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                  exit={{ opacity: 0, rotateY: 90, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 100, damping: 18 }}
                  className="space-y-5"
                  style={{ perspective: 800 }}
                >
                  {/* File row */}
                  <motion.div
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl p-4 flex items-center justify-between border"
                    style={{
                      background: "rgba(15,25,60,0.6)",
                      borderColor: "rgba(96,165,250,0.2)",
                    }}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(59,111,255,0.2)", color: "#60a5fa" }}
                      >
                        <FileText className="w-5 h-5" />
                      </motion.div>
                      <div className="truncate">
                        <p className="font-medium truncate" style={{ color: "#e2e8f0" }}>
                          {file.name}
                        </p>
                        <p className="text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-sm font-medium px-2 py-1 rounded-lg transition-all"
                      style={{ color: "rgba(148,163,184,0.6)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f87171")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.6)")}
                    >
                      Change
                    </button>
                  </motion.div>

                  {/* Selects */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {[
                      {
                        label: "Investor Type",
                        value: investorType,
                        onChange: setInvestorType,
                        options: ["High Aggressive", "Aggressive", "Moderate", "Conservative"],
                      },
                      {
                        label: "Age Group",
                        value: ageGroup,
                        onChange: setAgeGroup,
                        options: ["20-35", "35-50", "50-60", "60+"],
                      },
                    ].map((field) => (
                      <div key={field.label} className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "rgba(148,163,184,0.8)" }}>
                          {field.label}
                        </label>
                        <select
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                          style={{
                            background: "rgba(15,25,60,0.7)",
                            border: "1px solid rgba(96,165,250,0.25)",
                            color: "#e2e8f0",
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.6)")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.25)")}
                        >
                          {field.options.map((o) => (
                            <option key={o} value={o} style={{ background: "#0d1544" }}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </motion.div>

                  {/* Password */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <label
                      className="text-sm font-medium flex items-center gap-2"
                      style={{ color: "rgba(148,163,184,0.8)" }}
                    >
                      <Lock className="w-4 h-4" style={{ color: "rgba(148,163,184,0.5)" }} />
                      PDF Password (if protected)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: "rgba(15,25,60,0.7)",
                        border: "1px solid rgba(96,165,250,0.25)",
                        color: "#e2e8f0",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.6)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.25)")}
                    />
                  </motion.div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-lg p-3 text-sm flex items-start gap-2"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>{error.message}</p>
                    </motion.div>
                  )}

                  {/* Submit button */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <motion.button
                      onClick={handleSubmit}
                      disabled={isPending}
                      className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 relative overflow-hidden"
                      style={{
                        background: isPending
                          ? "rgba(30,40,80,0.8)"
                          : "linear-gradient(135deg, #3b6fff 0%, #9333ea 50%, #06b6d4 100%)",
                        backgroundSize: "200% 200%",
                        color: isPending ? "rgba(148,163,184,0.5)" : "white",
                        cursor: isPending ? "not-allowed" : "pointer",
                      }}
                      animate={
                        !isPending
                          ? { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
                          : {}
                      }
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      whileHover={!isPending ? { scale: 1.02, y: -2 } : {}}
                      whileTap={!isPending ? { scale: 0.98 } : {}}
                    >
                      {/* Button shimmer */}
                      {!isPending && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.15) 50%, transparent 65%)",
                            backgroundSize: "200% 100%",
                          }}
                          animate={{ backgroundPosition: ["-200% 0", "200% 0"] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                        />
                      )}
                      {/* Glow */}
                      {!isPending && (
                        <motion.div
                          className="absolute inset-0 rounded-xl pointer-events-none"
                          animate={{
                            boxShadow: [
                              "0 0 20px rgba(59,111,255,0.4)",
                              "0 0 30px rgba(147,51,234,0.5)",
                              "0 0 20px rgba(6,182,212,0.4)",
                              "0 0 20px rgba(59,111,255,0.4)",
                            ],
                          }}
                          transition={{ duration: 4, repeat: Infinity }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        {isPending ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Analyzing Portfolio...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Analyze Portfolio
                          </>
                        )}
                      </span>
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
