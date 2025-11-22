import React from 'react';
import { Youtube, Sparkles, Zap } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import { ConceptCard } from './ConceptCard';
import { ScanningLoader } from './Loader';
import { BrandProfileManager } from './BrandProfileManager';
import { THUMBNAIL_STYLES } from '../constants';
import { Concept, ThumbnailStyle, BrandProfile } from '../types';

interface GenerationPanelProps {
  mobileView: string;
  topic: string;
  onTopicChange: (topic: string) => void;
  selectedStyle: ThumbnailStyle;
  onStyleChange: (style: ThumbnailStyle) => void;
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
  isBrainstorming: boolean;
  onBrainstorm: () => void;
  concepts: Concept[];
  onConceptUpdate: (id: string, updates: Partial<Concept>) => void;
  onGenerateImage: (concept: Concept) => void;
  isGenerating: boolean;
}

export function GenerationPanel({
  mobileView,
  topic,
  onTopicChange,
  selectedStyle,
  onStyleChange,
  savedProfiles,
  activeProfileId,
  onActiveProfileChange,
  analyzingState,
  onAnalyzingStateChange,
  onFileUpload,
  onSaveProfile,
  onCancelAnalysis,
  isBrainstorming,
  onBrainstorm,
  concepts,
  onConceptUpdate,
  onGenerateImage,
  isGenerating
}: GenerationPanelProps) {
  return (
    <aside className={`${mobileView === 'ideas' ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] bg-dark-900 flex-col border-r border-dark-800 h-[calc(100vh-60px)] md:h-screen z-10 shadow-2xl`}>
      <header className="p-4 border-b border-dark-800 shrink-0 flex items-center justify-between bg-dark-950">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-anton text-white tracking-wider">Thumbn<span className="text-brand-500">AI</span>l</h1>
        </div>
      </header>

      <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
        {/* Brand Identity Section */}
        <BrandProfileManager
          savedProfiles={savedProfiles}
          activeProfileId={activeProfileId}
          onActiveProfileChange={onActiveProfileChange}
          analyzingState={analyzingState}
          onAnalyzingStateChange={onAnalyzingStateChange}
          onFileUpload={onFileUpload}
          onSaveProfile={onSaveProfile}
          onCancelAnalysis={onCancelAnalysis}
        />

        {/* Generation Form */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center">
            <Youtube className="w-4 h-4 mr-2"/>Video Details
          </h2>
          <Input
            label="Video Topic or Title"
            placeholder="e.g., 'Slingmods 2025 Product Reveal'"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Thumbnail Style</label>
            <div className="grid grid-cols-2 gap-2">
              {THUMBNAIL_STYLES.map(style => (
                <button
                  key={style.value}
                  onClick={() => onStyleChange(style.value)}
                  className={`p-2 rounded-lg text-left text-xs transition-all border ${selectedStyle === style.value ? 'bg-brand-600/20 border-brand-500 text-white' : 'bg-dark-800 border-dark-700 hover:border-dark-600 text-gray-400'}`}
                >
                  <span className="mr-2">{style.icon}</span>{style.label.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={onBrainstorm}
            isLoading={isBrainstorming}
            className="w-full h-12 text-lg"
            size="md"
            icon={<Sparkles className="w-5 h-5"/>}
          >
            Brainstorm Concepts
          </Button>
        </div>

        {/* Concepts */}
        <div className="space-y-3 pb-10">
          {isBrainstorming && <ScanningLoader text="Generating viral ideas..." />}
          {concepts.map(c => (
            <ConceptCard
              key={c.id}
              concept={c}
              onGenerate={onGenerateImage}
              onUpdate={onConceptUpdate}
              isGenerating={isGenerating}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
