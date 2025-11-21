import React, { useState } from 'react';
import { Concept } from '../types';
import { Button } from './Button';
import { Input, TextArea } from './Input';
import { Wand2, Pencil, Check, X } from 'lucide-react';

interface ConceptCardProps {
  concept: Concept;
  onGenerate: (concept: Concept) => void;
  onUpdate: (id: string, updates: Partial<Concept>) => void;
  isSelected?: boolean;
  isGenerating?: boolean;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({ concept, onGenerate, onUpdate, isSelected, isGenerating }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedConcept, setEditedConcept] = useState(concept);

  const handleSave = () => {
    onUpdate(concept.id, editedConcept);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedConcept(concept);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-5 rounded-xl border bg-dark-800 border-brand-500/50 shadow-lg space-y-3 relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-2 border-b border-dark-700 pb-2">
           <span className="text-xs font-mono text-brand-400 uppercase tracking-wider">Editing Concept</span>
        </div>
        
        <div className="space-y-3">
          <Input 
            label="Title"
            value={editedConcept.title}
            onChange={(e) => setEditedConcept({...editedConcept, title: e.target.value})}
            className="bg-dark-900/50"
          />

          <Input 
            label="Hook Text"
            value={editedConcept.hookText}
            onChange={(e) => setEditedConcept({...editedConcept, hookText: e.target.value})}
            className="bg-dark-900/50 font-mono text-xs"
          />

          <TextArea 
            label="Visual Prompt (Detailed Description)"
            value={editedConcept.visualDescription}
            onChange={(e) => setEditedConcept({...editedConcept, visualDescription: e.target.value})}
            className="bg-dark-900/50 min-h-[150px] text-sm leading-relaxed"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-dark-700 mt-2">
          <Button variant="ghost" size="sm" onClick={handleCancel} icon={<X className="w-3 h-3"/>}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} icon={<Check className="w-3 h-3"/>}>Save Changes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative p-5 rounded-xl border transition-all duration-200 hover:border-brand-500/50 cursor-default
      ${isSelected 
        ? 'bg-dark-800 border-brand-500 shadow-[0_0_30px_-10px_rgba(225,29,72,0.3)]' 
        : 'bg-dark-900 border-dark-800'
      }`}>
      
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-10 transition-opacity z-0 pointer-events-none">
        <Wand2 className="w-12 h-12 text-brand-600" />
      </div>

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button 
          onClick={() => setIsEditing(true)}
          className="p-2 bg-dark-800 hover:bg-brand-600 text-gray-400 hover:text-white rounded-lg border border-dark-700 hover:border-brand-500 transition-all shadow-lg"
          title="Edit Concept & Prompt"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="text-xl font-display font-bold text-white mb-2 pr-12 leading-tight relative z-10">
        {concept.title}
      </h3>
      
      <div className="flex items-start gap-2 mb-4 relative z-10">
        <div className="px-2 py-1 bg-dark-950 rounded text-xs font-mono text-brand-400 border border-brand-900/50 shrink-0">
          HOOK
        </div>
        <p className="text-sm text-gray-300 font-medium italic">"{concept.hookText}"</p>
      </div>

      <p className="text-sm text-gray-400 mb-4 line-clamp-3 leading-relaxed relative z-10">
        {concept.visualDescription}
      </p>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-800/50 relative z-20">
        <span className="text-xs text-gray-500 font-mono">Viral Score: High</span>
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            onGenerate(concept);
          }} 
          disabled={isGenerating}
          size="sm"
          icon={<Wand2 className="w-3 h-3" />}
        >
          Generate
        </Button>
      </div>
    </div>
  );
};