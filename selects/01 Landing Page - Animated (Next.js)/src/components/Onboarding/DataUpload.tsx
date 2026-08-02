"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface DataUploadProps {
  onNext: (data: { files: File[]; links: string[] }) => void;
  onSkip: () => void;
}

export default function DataUpload({ onNext, onSkip }: DataUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [linkText, setLinkText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleContinue = () => {
    const links = linkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    onNext({ files, links });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-2xl mx-auto px-8 flex flex-col items-center"
    >
      <h2
        className="text-center mb-12"
        style={{
          fontFamily:
            "var(--font-playfair), 'Playfair Display', Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
          fontWeight: 400,
        }}
      >
        so, what&apos;re you into?
      </h2>

      <div className="space-y-6 w-full">
        {/* Link input */}
        <div>
          <label className="text-white/40 text-xs tracking-[0.15em] uppercase mb-2 block">
            Paste links or text
          </label>
          <textarea
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Letterboxd profile URL, IMDB list, or paste your film list..."
            rows={3}
            className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 text-sm outline-none focus:border-white/25 transition-colors resize-none"
          />
        </div>

        {/* Drag and drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-white/40 bg-white/5"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.zip,.json,.txt,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          <svg
            className="mx-auto mb-4"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>

          <p className="text-white/40 text-sm">
            Drop Letterboxd exports, IMDB CSVs, zips, or screenshots
          </p>
          <p className="text-white/20 text-xs mt-2">
            CSV, ZIP, JSON, TXT, PNG, JPG
          </p>
        </div>

        {/* Uploaded files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
                <span className="text-white/60 text-sm truncate">
                  {f.name}
                </span>
                <span className="text-white/20 text-xs ml-auto">
                  {(f.size / 1024).toFixed(0)}KB
                </span>
              </div>
            ))}
          </div>
        )}

        {/* App icons */}
        <div className="flex items-center justify-center gap-6 py-4">
          {/* Letterboxd */}
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <div className="flex gap-0.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00E054]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#40BCF4]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF8000]" />
            </div>
            <span>Letterboxd</span>
          </div>
          {/* IMDB */}
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <div className="bg-[#F5C518] text-black text-[8px] font-bold px-1 py-0.5 rounded-sm">
              IMDb
            </div>
            <span>IMDB</span>
          </div>
          {/* Apple Notes */}
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <div className="w-5 h-5 rounded bg-[#FFCC00] flex items-center justify-center">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <span>Notes</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium tracking-[0.15em] uppercase hover:bg-white/90 transition-colors cursor-pointer"
          >
            Continue
          </button>
          <button
            onClick={onSkip}
            className="px-6 py-3 text-white/30 text-sm tracking-[0.1em] uppercase hover:text-white/50 transition-colors cursor-pointer"
          >
            Skip for now
          </button>
        </div>
      </div>
    </motion.div>
  );
}
