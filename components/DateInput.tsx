import React, { useState } from 'react';
import { formatDisplayDate } from '../utils';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  compact?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({ 
  value, 
  onChange, 
  label, 
  min,
  max,
  className = "",
  placeholder = "Select Date",
  compact = false
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Show formatted overlay if there is a value and user is NOT interacting
  const showOverlay = value && !isFocused;

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-0.5 sm:mb-1">{label}</label>}
      
      <div className="relative w-full group">
        {/* 
            Native Input 
            - Always rendered to maintain layout
            - Receives focus/clicks (even through overlay via pointer-events-none)
        */}
        <input 
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full border border-gray-300 bg-white font-sans text-gray-900 placeholder-gray-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 ${
            compact
              ? 'rounded-md px-2 py-1 text-xs sm:text-sm'
              : 'rounded-xl px-4 py-3 text-base'
          }`}
          placeholder={placeholder}
        />

        {/* 
            Formatted Overlay 
            - Covers the input completely when visible
            - pointer-events-none ensures clicks pass through to the input
        */}
        {showOverlay && (
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-between border border-gray-300 bg-white ${
            compact
              ? 'rounded-md px-2 py-1 text-xs sm:text-sm'
              : 'rounded-xl px-4 py-3 text-base'
          }`}>
             <span className="font-medium text-gray-900 font-sans truncate">
               {formatDisplayDate(value)}
             </span>
             {/* Calendar Icon SVG */}
             <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-gray-700`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
          </div>
        )}
      </div>
    </div>
  );
};
