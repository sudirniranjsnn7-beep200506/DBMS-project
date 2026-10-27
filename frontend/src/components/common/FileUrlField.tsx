// ==============================================================================
// AssetVault: Reusable FileUrlField Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// URL input with validation helper, copy-to-clipboard, and quick sample presets
// ==============================================================================

import React, { useState } from 'react';
import { Link2, Copy, Check, AlertCircle, Sparkles } from 'lucide-react';

export interface FileUrlPreset {
  label: string;
  url: string;
}

export interface FileUrlFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string | null;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  showPresets?: boolean;
  presets?: FileUrlPreset[];
}

const DEFAULT_PRESETS: FileUrlPreset[] = [
  { label: 'AWS S3', url: 'https://assetvault-storage.s3.us-east-1.amazonaws.com/assets/archive-v1.zip' },
  { label: 'Cloudinary', url: 'https://res.cloudinary.com/assetvault/raw/upload/v1/assets/model-3d.glb' },
  { label: 'Fastly CDN', url: 'https://cdn.assetvault.io/releases/build-v2.0.tar.gz' },
  { label: 'Figma', url: 'https://www.figma.com/file/AssetVault-Design-System-2026' },
];

export const FileUrlField: React.FC<FileUrlFieldProps> = ({
  label = 'File URL',
  value,
  onChange,
  required = false,
  error,
  helperText,
  placeholder = 'https://storage.assetvault.io/...',
  disabled = false,
  className = '',
  id,
  showPresets = true,
  presets = DEFAULT_PRESETS,
}) => {
  const [copied, setCopied] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const isValidUrl = (url: string): boolean => {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isUrlValid = isValidUrl(value);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>

          {showPresets && !disabled && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Sparkles className="w-3 h-3 text-primary-500" />
              <span>Presets:</span>
              <div className="inline-flex gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange(preset.url)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400 dark:text-slate-500">
          <Link2 className="w-4 h-4" />
        </div>

        <input
          id={inputId}
          type="url"
          value={value ?? ''}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full pl-9 pr-9 py-2 text-xs rounded-lg border font-mono transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
            error || (value && !isUrlValid)
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500'
              : 'border-slate-300 dark:border-slate-700'
          }`}
        />

        {value && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title={copied ? 'Copied to clipboard' : 'Copy URL'}
            aria-label={copied ? 'Copied' : 'Copy'}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {error ? (
        <p className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : value && !isUrlValid ? (
        <p className="flex items-center gap-1 text-xs text-rose-500 font-medium mt-0.5 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Must be a valid HTTP or HTTPS URL (e.g. https://domain.com/path)</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
};
