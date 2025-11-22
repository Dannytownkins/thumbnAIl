import React, { useRef } from 'react';
import { Image as ImageIcon, Layers, Sticker, Type as TypeIcon, Eye, ArrowUp, ArrowDown, Box, Upload } from 'lucide-react';
import { Button } from './Button';
import { LayerControls } from './LayerControls';
import { CanvasState, Layer, ImageLayer, TextLayer } from '../types';
import { COMMON_ASSETS } from '../constants';

const GRADIENT_PRESETS = [
  { name: 'Midnight', c1: '#0f172a', c2: '#312e81' },
  { name: 'Hot YouTube', c1: '#ef4444', c2: '#7f1d1d' },
  { name: 'Oceanic', c1: '#0ea5e9', c2: '#1e3a8a' },
  { name: 'Neon Violet', c1: '#a855f7', c2: '#4c1d95' },
  { name: 'Emerald', c1: '#10b981', c2: '#064e3b' },
  { name: 'Sunset', c1: '#f97316', c2: '#be123c' },
  { name: 'Charcoal', c1: '#27272a', c2: '#09090b' },
  { name: 'Gold', c1: '#eab308', c2: '#854d0e' },
];

interface RightPanelProps {
  activeTab: 'generate' | 'layers' | 'backgrounds' | 'elements';
  onTabChange: (tab: 'generate' | 'layers' | 'backgrounds' | 'elements') => void;
  canvasState: CanvasState;
  onCanvasStateChange: (state: CanvasState | ((prev: CanvasState) => CanvasState)) => void;
  selectionId: string | null;
  onSelectionChange: (id: string | null) => void;
  onMobileViewChange: (view: 'ideas' | 'studio' | 'edit') => void;
  backgroundLibrary: string[];
  onBackgroundLibraryChange: (library: string[]) => void;
  isIsolatingProduct: boolean;
  onProductUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAddTextLayer: () => void;
  onAddElement: (url: string) => void;
  mobileView: string;
}

export function RightPanel({
  activeTab,
  onTabChange,
  canvasState,
  onCanvasStateChange,
  selectionId,
  onSelectionChange,
  onMobileViewChange,
  backgroundLibrary,
  onBackgroundLibraryChange,
  isIsolatingProduct,
  onProductUpload,
  onAddTextLayer,
  onAddElement,
  mobileView
}: RightPanelProps) {
  const productInputRef = useRef<HTMLInputElement>(null);
  const elementInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    onCanvasStateChange(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } as Layer : l)
    }));
  };

  const deleteLayer = (id: string) => {
    onCanvasStateChange(prev => ({
      ...prev,
      layers: prev.layers.filter(l => l.id !== id)
    }));
    if (selectionId === id) onSelectionChange(null);
  };

  const duplicateLayer = (layer: Layer) => {
    const newLayer = {
      ...layer,
      id: crypto.randomUUID(),
      x: layer.x + 40,
      y: layer.y + 40,
    };
    onCanvasStateChange(prev => ({
      ...prev,
      layers: [...prev.layers, newLayer]
    }));
    onSelectionChange(newLayer.id);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    onCanvasStateChange(prev => {
      const index = prev.layers.findIndex(l => l.id === id);
      if (index === -1) return prev;

      const newLayers = [...prev.layers];
      if (direction === 'up' && index < newLayers.length - 1) {
        [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
      } else if (direction === 'down' && index > 0) {
        [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
      }

      return { ...prev, layers: newLayers };
    });
  };

  const handleElementUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onAddElement(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      onBackgroundLibraryChange([url, ...backgroundLibrary]);
      onCanvasStateChange(prev => ({ ...prev, backgroundType: 'image', backgroundUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const selectedLayer = canvasState.layers.find(l => l.id === selectionId);

  return (
    <aside className={`${mobileView === 'edit' ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] bg-dark-900 flex-col border-l border-dark-800 h-[calc(100vh-60px)] md:h-screen z-10 shadow-2xl`}>
      <div className="flex p-2 bg-dark-950 border-b border-dark-800 shrink-0 gap-1">
        <button onClick={() => onTabChange('layers')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'layers' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><Layers className="w-4 h-4 mr-2"/>Layers</button>
        <button onClick={() => onTabChange('elements')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'elements' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><Sticker className="w-4 h-4 mr-2"/>Elements</button>
        <button onClick={() => onTabChange('backgrounds')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'backgrounds' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><ImageIcon className="w-4 h-4 mr-2"/>BGs</button>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar bg-dark-900/50">
        {activeTab === 'layers' && (
          <div className="space-y-6">
            {/* Unified Layer List */}
            <div className="space-y-2">
              <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center">Layer Stack (Top = Front)</h3>
              <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
                {[...canvasState.layers].reverse().map((layer, revIndex) => {
                  const realIndex = canvasState.layers.length - 1 - revIndex;
                  return (
                    <div key={layer.id} className={`p-3 flex items-center gap-3 border-b border-dark-700 last:border-0 ${selectionId === layer.id ? 'bg-brand-900/20' : 'hover:bg-dark-700/50'} transition-colors cursor-pointer`}
                      onClick={() => { onSelectionChange(layer.id); onMobileViewChange('edit'); }}
                    >
                      <div className="text-gray-500">
                        {layer.type === 'text' ? <TypeIcon className="w-4 h-4"/> : ((layer as ImageLayer).isProduct ? <Box className="w-4 h-4 text-brand-400"/> : <Sticker className="w-4 h-4"/>)}
                      </div>
                      <div className="flex-1 truncate text-sm font-medium text-gray-300">
                        {layer.type === 'text' ? (layer as TextLayer).text : ((layer as ImageLayer).isProduct ? 'Product' : 'Image Asset')}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }} className={`p-1 rounded hover:bg-dark-600 ${!layer.visible ? 'text-gray-600' : 'text-brand-400'}`}>
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); }} className="p-1 rounded hover:bg-dark-600 text-gray-400" disabled={realIndex === canvasState.layers.length - 1}>
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); }} className="p-1 rounded hover:bg-dark-600 text-gray-400" disabled={realIndex === 0}>
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {canvasState.layers.length === 0 && <div className="p-4 text-center text-xs text-gray-500">No Layers</div>}
              </div>
            </div>

            {/* Selected Layer Properties */}
            <LayerControls
              selectionId={selectionId}
              layer={selectedLayer}
              onUpdateLayer={updateLayer}
              onDeleteLayer={deleteLayer}
              onDuplicateLayer={duplicateLayer}
            />

            {/* Add Actions */}
            <div className="pt-4 border-t border-dark-800 space-y-3">
              <div className="p-4 bg-dark-800 rounded-lg border border-dark-700 group hover:border-brand-500 transition-colors">
                <Button className="w-full" variant="secondary" size="sm" icon={<Box className="w-4 h-4" />} onClick={() => productInputRef.current?.click()} isLoading={isIsolatingProduct}>
                  {isIsolatingProduct ? 'Isolating Subject...' : 'Add Product / Subject'}
                </Button>
                <input type="file" ref={productInputRef} onChange={onProductUpload} className="hidden" accept="image/*" />
                <p className="text-[10px] text-gray-500 mt-2 text-center">Supports auto-background removal</p>
              </div>
              <Button className="w-full" variant="ghost" size="sm" onClick={onAddTextLayer} icon={<TypeIcon className="w-4 h-4"/>}>Add New Text Layer</Button>
            </div>
          </div>
        )}

        {activeTab === 'backgrounds' && (
          <div className="space-y-6">
            <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 space-y-4">
              <h3 className="text-[10px] uppercase font-bold text-gray-500">Gradient Base</h3>
              <div className="flex gap-2">
                <input type="color" value={canvasState.backgroundGradient.color1} onChange={(e) => onCanvasStateChange(prev => ({ ...prev, backgroundType: 'gradient', backgroundGradient: { ...prev.backgroundGradient, color1: e.target.value } }))} className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer" />
                <input type="color" value={canvasState.backgroundGradient.color2} onChange={(e) => onCanvasStateChange(prev => ({ ...prev, backgroundType: 'gradient', backgroundGradient: { ...prev.backgroundGradient, color2: e.target.value } }))} className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer" />
              </div>

              <h4 className="text-[10px] uppercase font-bold text-gray-500 pt-2 border-t border-dark-700">Presets</h4>
              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => onCanvasStateChange(prev => ({
                      ...prev,
                      backgroundType: 'gradient',
                      backgroundGradient: { ...prev.backgroundGradient, color1: p.c1, color2: p.c2 }
                    }))}
                    className="w-full aspect-square rounded-full border border-dark-600 hover:border-brand-500 hover:scale-110 transition-all shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
                    title={p.name}
                  />
                ))}
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => backgroundInputRef.current?.click()} icon={<Upload className="w-4 h-4"/>}>Upload BG Image</Button>
            <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
            <div className="grid grid-cols-2 gap-2">
              {backgroundLibrary.map(bg => (
                <div key={bg} className="relative aspect-video rounded-md overflow-hidden cursor-pointer group border border-dark-700 hover:border-brand-500" onClick={() => onCanvasStateChange(prev => ({...prev, backgroundType: 'image', backgroundUrl: bg}))}>
                  <img src={bg} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'elements' && (
          <div className="space-y-4">
            <Button variant="secondary" className="w-full" onClick={() => elementInputRef.current?.click()} icon={<Upload className="w-4 h-4"/>}>Upload Custom Element</Button>
            <input type="file" ref={elementInputRef} onChange={handleElementUpload} className="hidden" accept="image/*" />
            {COMMON_ASSETS.map(category => (
              <div key={category.category}>
                <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">{category.category}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {category.items.map(item => (
                    <button key={item} onClick={() => onAddElement(item)} className="bg-dark-800 p-2 rounded-md aspect-square flex items-center justify-center hover:bg-dark-700 transition-colors border border-dark-700 hover:border-brand-500">
                      <img src={item} className="max-w-full max-h-full" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
