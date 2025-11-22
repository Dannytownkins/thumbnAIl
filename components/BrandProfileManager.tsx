import React, { useRef } from 'react';
import { Fingerprint, Upload, X, Check } from 'lucide-react';
import { Button } from './Button';
import { Input, TextArea } from './Input';
import { ScanningLoader } from './Loader';
import { BrandProfile } from '../types';

interface BrandProfileManagerProps {
  savedProfiles: BrandProfile[];
  activeProfileId: string | null;
  onActiveProfileChange: (id: string | null) => void;
  analyzingState: {
    isAnalyzing: boolean;
    previewUrl: string | null;
    detectedPrompt: string;
    profileName: string;
  };
  onAnalyzingStateChange: (state: {
    isAnalyzing: boolean;
    previewUrl: string | null;
    detectedPrompt: string;
    profileName: string;
  }) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveProfile: () => void;
  onCancelAnalysis: () => void;
}

export function BrandProfileManager({
  savedProfiles,
  activeProfileId,
  onActiveProfileChange,
  analyzingState,
  onAnalyzingStateChange,
  onFileUpload,
  onSaveProfile,
  onCancelAnalysis
}: BrandProfileManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 pb-6 border-b border-dark-800">
      <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center">
        <Fingerprint className="w-4 h-4 mr-2"/>Brand Identity
      </h2>
      {analyzingState.isAnalyzing || analyzingState.detectedPrompt || analyzingState.previewUrl ? (
        <div className="bg-dark-800 border border-brand-500/30 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-brand-400">Analysis Staging</span>
            <button onClick={onCancelAnalysis}><X className="w-4 h-4 text-gray-500 hover:text-white"/></button>
          </div>
          {analyzingState.previewUrl && (
            <div className="w-full h-32 bg-dark-950 rounded-md overflow-hidden relative border border-dark-700">
              <img src={analyzingState.previewUrl} className="w-full h-full object-cover opacity-80" />
              {analyzingState.isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <ScanningLoader text="" />
                </div>
              )}
            </div>
          )}
          <Input
            label="Style Name"
            placeholder="e.g. Tech Minimalist"
            value={analyzingState.profileName}
            onChange={(e) => onAnalyzingStateChange({...analyzingState, profileName: e.target.value})}
            className="bg-dark-900/50 border-brand-500/30 focus:border-brand-500"
          />
          <TextArea
            label="Detected Style Prompt"
            value={analyzingState.detectedPrompt}
            onChange={(e) => onAnalyzingStateChange({...analyzingState, detectedPrompt: e.target.value})}
            className="text-xs font-mono h-24 bg-dark-900/50"
            placeholder="AI is analyzing..."
          />
          <Button
            size="sm"
            className="w-full"
            onClick={onSaveProfile}
            disabled={analyzingState.isAnalyzing}
            icon={<Check className="w-3 h-3"/>}
          >
            Save as New Profile
          </Button>
        </div>
      ) : (
        <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 space-y-3">
          <select
            value={activeProfileId || ''}
            onChange={(e) => onActiveProfileChange(e.target.value || null)}
            className="w-full bg-dark-900 border border-dark-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none"
          >
            <option value="">Default / No Style</option>
            {savedProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload className="w-3 h-3"/>}
          >
            Analyze New Style
          </Button>
          <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" accept="image/*"/>
        </div>
      )}
    </div>
  );
}
