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
}

export const DateInput: React.FC<DateInputProps> = ({ 
  value, 
  onChange, 
  label, 
  min,
  max,
  className = "",
  placeholder = "Select Date"
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Show formatted overlay if there is a value and user is NOT interacting
  const showOverlay = value && !isFocused;

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
      
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white placeholder-gray-400 font-sans"
          placeholder={placeholder}
        />

        {/* 
            Formatted Overlay 
            - Covers the input completely when visible
            - pointer-events-none ensures clicks pass through to the input
        */}
        {showOverlay && (
          <div className="absolute inset-0 px-4 py-2 border border-gray-300 rounded-lg bg-white flex items-center justify-between pointer-events-none">
             <span className="font-medium text-gray-900 font-sans truncate">
               {formatDisplayDate(value)}
             </span>
             {/* Calendar Icon SVG */}
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
          </div>
        )}
      </div>
    </div>
  );
};
