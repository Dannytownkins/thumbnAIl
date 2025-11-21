import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-dark-900 border border-dark-800 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition-all placeholder-gray-600 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`w-full bg-dark-900 border border-dark-800 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition-all placeholder-gray-600 min-h-[100px] resize-y ${className}`}
        {...props}
      />
    </div>
  );
};