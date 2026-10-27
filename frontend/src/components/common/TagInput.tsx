// ==============================================================================
// AssetVault: TagInput Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Dynamic badge manager allowing tag addition, removal, and keyboard control
// ==============================================================================

import React, { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add tag and press Enter...',
  maxTags = 10,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, '');
    if (!trimmed) return;

    if (tags.length >= maxTags) return;

    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const safeTags = tags || [];

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500 transition-all ${className}`}
    >
      {safeTags.map((tag, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60 animate-fade-in"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(idx)}
            className="text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 rounded p-0.5"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {safeTags.length < maxTags && (
        <div className="flex-1 min-w-[120px] flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={tags.length === 0 ? placeholder : 'Add more...'}
            className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
};
