import React from 'react';
import { Box, Sticker, Type as TypeIcon, Trash2, Copy, AlignLeft, AlignCenter, AlignRight, MoveVertical } from 'lucide-react';
import { Button } from './Button';
import { TextArea } from './Input';
import { BRAND_FONTS } from '../constants';
import { Layer, ImageLayer, TextLayer, BrandFont } from '../types';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

interface LayerControlsProps {
  selectionId: string | null;
  layer: Layer | undefined;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (layer: Layer) => void;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return `rgba(0,0,0,${alpha})`;

  let c = hex.substring(1).split('');
  if(c.length === 3){
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  const r = parseInt(`${c[0]}${c[1]}`, 16);
  const g = parseInt(`${c[2]}${c[3]}`, 16);
  const b = parseInt(`${c[4]}${c[5]}`, 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export function LayerControls({ selectionId, layer, onUpdateLayer, onDeleteLayer, onDuplicateLayer }: LayerControlsProps) {
  if (!selectionId) {
    return (
      <div className="text-center text-gray-500 text-sm p-8 bg-dark-800/30 rounded-lg border border-dashed border-dark-700">
        Click an item to edit properties
      </div>
    );
  }

  if (!layer) return null;

  if (layer.type === 'image') {
    const imgLayer = layer as ImageLayer;

    const handleAlign = (type: 'left' | 'center' | 'right' | 'middle') => {
      let newX = imgLayer.x;
      let newY = imgLayer.y;
      if (type === 'left') newX = CANVAS_WIDTH * 0.25;
      if (type === 'center') newX = CANVAS_WIDTH * 0.5;
      if (type === 'right') newX = CANVAS_WIDTH * 0.75;
      if (type === 'middle') newY = CANVAS_HEIGHT * 0.5;
      onUpdateLayer(imgLayer.id, { x: newX, y: newY });
    };

    return (
      <div className="bg-dark-900 border border-dark-800 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-brand-400 uppercase flex items-center">
            {imgLayer.isProduct ? <Box className="w-3 h-3 mr-2"/> : <Sticker className="w-3 h-3 mr-2"/>}
            {imgLayer.isProduct ? 'Product Layer' : 'Element Layer'}
          </h3>
          <div className="flex gap-1">
            <button onClick={() => onDuplicateLayer(imgLayer)} className="p-1 hover:bg-dark-700 rounded"><Copy className="w-4 h-4 text-gray-400"/></button>
            <button onClick={() => onDeleteLayer(imgLayer.id)} className="p-1 hover:bg-red-900/30 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleAlign('left')} className="px-0"><AlignLeft className="w-4 h-4"/></Button>
          <Button variant="secondary" size="sm" onClick={() => handleAlign('center')} className="px-0"><AlignCenter className="w-4 h-4"/></Button>
          <Button variant="secondary" size="sm" onClick={() => handleAlign('right')} className="px-0"><AlignRight className="w-4 h-4"/></Button>
          <Button variant="secondary" size="sm" onClick={() => handleAlign('middle')} className="px-0"><MoveVertical className="w-4 h-4"/></Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Scale</span>
            <input type="range" min="0.1" max="3" step="0.1" value={imgLayer.scale} onChange={(e) => onUpdateLayer(imgLayer.id, { scale: parseFloat(e.target.value) })} className="w-full accent-brand-500" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Rotation</span>
            <input type="range" min="-180" max="180" step="1" value={imgLayer.rotation} onChange={(e) => onUpdateLayer(imgLayer.id, { rotation: parseInt(e.target.value) })} className="w-full accent-brand-500" />
          </div>
        </div>

        <div className="pt-2 border-t border-dark-800 space-y-3">
          <label className="flex items-center text-xs text-gray-300 cursor-pointer">
            <input type="checkbox" checked={imgLayer.shadow} onChange={(e) => onUpdateLayer(imgLayer.id, { shadow: e.target.checked })} className="mr-2 rounded bg-dark-700 border-dark-600 text-brand-600 focus:ring-0" />
            Drop Shadow
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center text-xs text-gray-300 cursor-pointer flex-1">
              <input type="checkbox" checked={imgLayer.glow} onChange={(e) => onUpdateLayer(imgLayer.id, { glow: e.target.checked })} className="mr-2 rounded bg-dark-700 border-dark-600 text-brand-600 focus:ring-0" />
              Outer Glow
            </label>
            <input type="color" value={imgLayer.glowColor || '#ffffff'} onChange={(e) => onUpdateLayer(imgLayer.id, { glowColor: e.target.value })} disabled={!imgLayer.glow} className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer disabled:opacity-50" />
          </div>
        </div>
      </div>
    );
  }

  // Text Layer
  const text = layer as TextLayer;
  const shadowColorWithAlpha = hexToRgba(text.shadowColor, text.shadowOpacity ?? 1);

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-brand-400 uppercase flex items-center"><TypeIcon className="w-3 h-3 mr-2"/>Text Layer</h3>
        <div className="flex gap-1">
          <button onClick={() => onDuplicateLayer(text)} className="p-1 hover:bg-dark-700 rounded"><Copy className="w-4 h-4 text-gray-400"/></button>
          <button onClick={() => onDeleteLayer(text.id)} className="p-1 hover:bg-red-900/30 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
        </div>
      </div>

      <TextArea value={text.text} onChange={e => onUpdateLayer(text.id, { text: e.target.value })} className="text-lg font-bold" />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-gray-400">Font</span>
          <select value={text.font} onChange={e => onUpdateLayer(text.id, { font: e.target.value as BrandFont })} className="w-full bg-dark-800 border border-dark-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
            {BRAND_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-gray-400">Color</span>
          <input type="color" value={text.color} onChange={e => onUpdateLayer(text.id, { color: e.target.value })} className="w-full h-9 p-0 bg-transparent border-none rounded cursor-pointer" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-gray-400">Font Size ({text.fontSize}px)</span>
          <input type="range" min="20" max="600" step="5" value={text.fontSize} onChange={e => onUpdateLayer(text.id, { fontSize: parseInt(e.target.value) })} className="w-full accent-brand-500" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-gray-400">Rotation ({text.rotation}°)</span>
          <input type="range" min="-45" max="45" step="1" value={text.rotation} onChange={e => onUpdateLayer(text.id, { rotation: parseInt(e.target.value) })} className="w-full accent-brand-500" />
        </div>
      </div>

      {/* Stroke Section */}
      <div className="pt-2 border-t border-dark-800 space-y-3">
        <h4 className="text-[10px] uppercase font-bold text-gray-500">Stroke / Outline</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Width</span>
            <input type="range" min="0" max="40" step="1" value={text.strokeWidth} onChange={e => onUpdateLayer(text.id, { strokeWidth: parseInt(e.target.value) })} className="w-full accent-brand-500" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Color</span>
            <input type="color" value={text.strokeColor} onChange={e => onUpdateLayer(text.id, { strokeColor: e.target.value })} className="w-full h-9 p-0 bg-transparent border-none rounded cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Shadow Section */}
      <div className="pt-2 border-t border-dark-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] uppercase font-bold text-gray-500">Drop Shadow</h4>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={!!text.shadow} onChange={e => onUpdateLayer(text.id, { shadow: e.target.checked })} className="sr-only peer"/>
            <div className="w-7 h-4 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-600"></div>
          </label>
        </div>

        {text.shadow && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12">Color</span>
              <input type="color" value={text.shadowColor} onChange={e => onUpdateLayer(text.id, { shadowColor: e.target.value })} className="flex-1 h-6 p-0 bg-transparent border-none rounded cursor-pointer" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12">Opacity</span>
              <input type="range" min="0" max="1" step="0.05" value={text.shadowOpacity ?? 1} onChange={e => onUpdateLayer(text.id, { shadowOpacity: parseFloat(e.target.value) })} className="flex-1 accent-brand-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12">Blur</span>
              <input type="range" min="0" max="50" value={text.shadowBlur} onChange={e => onUpdateLayer(text.id, { shadowBlur: parseInt(e.target.value) })} className="flex-1 accent-brand-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12">X Off</span>
              <input type="range" min="-50" max="50" value={text.shadowOffsetX} onChange={e => onUpdateLayer(text.id, { shadowOffsetX: parseInt(e.target.value) })} className="flex-1 accent-brand-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12">Y Off</span>
              <input type="range" min="-50" max="50" value={text.shadowOffsetY} onChange={e => onUpdateLayer(text.id, { shadowOffsetY: parseInt(e.target.value) })} className="flex-1 accent-brand-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
