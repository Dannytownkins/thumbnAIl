import React from 'react';

export const ScanningLoader: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-dark-700 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-4 bg-dark-800 rounded-full animate-pulse"></div>
      </div>
      <p className="text-brand-100 font-display tracking-wide animate-pulse">{text}</p>
    </div>
  );
};