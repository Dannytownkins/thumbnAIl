import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CanvasState, Layer, ImageLayer, TextLayer } from '../types';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

interface CanvasProps {
  canvasState: CanvasState;
  selectionId: string | null;
  onSelectionChange: (id: string | null) => void;
  onLayerUpdate: (id: string, updates: Partial<Layer>) => void;
  onTabChange: (tab: 'generate' | 'layers' | 'backgrounds' | 'elements') => void;
  onMobileViewChange: (view: 'ideas' | 'studio' | 'edit') => void;
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

export function Canvas({ canvasState, selectionId, onSelectionChange, onLayerUpdate, onTabChange, onMobileViewChange }: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(0.5);
  const scaleFactorRef = useRef(0.5);

  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialLayerX: number;
    initialLayerY: number;
    targetId: string | null;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLayerX: 0,
    initialLayerY: 0,
    targetId: null
  });

  const updateScale = useCallback(() => {
    if (viewportRef.current) {
      const { clientWidth, clientHeight } = viewportRef.current;
      const padding = 40;
      const availableWidth = clientWidth - padding;
      const availableHeight = clientHeight - padding;

      const scaleX = availableWidth / CANVAS_WIDTH;
      const scaleY = availableHeight / CANVAS_HEIGHT;

      const newScale = Math.min(scaleX, scaleY);
      setScaleFactor(newScale);
      scaleFactorRef.current = newScale;
    }
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    resizeObserver.observe(el);

    updateScale();

    return () => resizeObserver.disconnect();
  }, [updateScale]);

  const handleMouseMoveGlobal = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag.isDragging || !drag.targetId) return;

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    const scale = scaleFactorRef.current;
    const adjustedDeltaX = deltaX / scale;
    const adjustedDeltaY = deltaY / scale;

    onLayerUpdate(drag.targetId, {
      x: drag.initialLayerX + adjustedDeltaX,
      y: drag.initialLayerY + adjustedDeltaY
    });
  }, [onLayerUpdate]);

  const handleMouseUpGlobal = useCallback(() => {
    dragRef.current.isDragging = false;
    dragRef.current.targetId = null;

    window.removeEventListener('mousemove', handleMouseMoveGlobal);
    window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, [handleMouseMoveGlobal]);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();

    const layer = canvasState.layers.find(l => l.id === id);
    if (!layer || layer.locked) return;

    onSelectionChange(id);
    onTabChange('layers');
    onMobileViewChange('edit');

    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialLayerX: layer.x,
      initialLayerY: layer.y,
      targetId: id
    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
  };

  const handleBackgroundClick = () => {
    onSelectionChange(null);
  };

  return (
    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden p-4 md:p-8" ref={viewportRef} onClick={handleBackgroundClick}>
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'center center',
          boxShadow: '0 0 100px rgba(0,0,0,0.5)',
        }}
        className="relative bg-dark-900 shrink-0 overflow-hidden"
        id="canvas-root"
      >
        {/* BACKGROUND */}
        <div
          className="absolute inset-0 z-0 pointer-events-none select-none"
          style={{
            background: canvasState.backgroundType === 'gradient'
              ? `linear-gradient(${canvasState.backgroundGradient.direction}, ${canvasState.backgroundGradient.color1}, ${canvasState.backgroundGradient.color2})`
              : 'none'
          }}
        >
          {canvasState.backgroundType === 'image' && (
            canvasState.backgroundUrl ?
              <img src={canvasState.backgroundUrl} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center text-dark-700 font-mono text-4xl">EMPTY CANVAS</div>
          )}
        </div>

        {/* UNIFIED LAYERS */}
        {canvasState.layers.map(layer => {
          if (!layer.visible) return null;
          const isSelected = selectionId === layer.id;

          if (layer.type === 'image') {
            const imgLayer = layer as ImageLayer;
            return (
              <div
                key={imgLayer.id}
                className="absolute top-0 left-0 select-none"
                style={{
                  transform: `translate(${imgLayer.x}px, ${imgLayer.y}px) rotate(${imgLayer.rotation}deg) scale(${imgLayer.scale})`,
                  zIndex: 1,
                  cursor: 'move'
                }}
                onMouseDown={(e) => handleMouseDown(e, imgLayer.id)}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative group" style={{ transform: 'translate(-50%, -50%)' }}>
                  {isSelected && (
                    <div className="absolute -inset-2 border-2 border-brand-500 rounded-sm pointer-events-none z-50">
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-brand-500"></div>
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-brand-500"></div>
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-brand-500"></div>
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-brand-500"></div>
                    </div>
                  )}
                  <img
                    src={imgLayer.url}
                    className="block max-w-none pointer-events-auto"
                    style={{
                      filter: imgLayer.shadow ? `drop-shadow(10px 10px 20px rgba(0,0,0,0.8))` : 'none',
                      minWidth: '50px', minHeight: '50px'
                    }}
                    draggable={false}
                  />
                  {imgLayer.glow && (
                    <img src={imgLayer.url} className="absolute top-0 left-0 pointer-events-none"
                      style={{
                        filter: `drop-shadow(0px 0px 20px ${imgLayer.glowColor}) drop-shadow(0px 0px 40px ${imgLayer.glowColor})`,
                        opacity: 0.8,
                        zIndex: -1
                      }}
                    />
                  )}
                </div>
              </div>
            );
          }
          else if (layer.type === 'text') {
            const text = layer as TextLayer;
            const shadowColorWithAlpha = hexToRgba(text.shadowColor, text.shadowOpacity ?? 1);

            return (
              <div
                key={text.id}
                className="absolute top-0 left-0 flex items-center justify-center select-none"
                style={{
                  transform: `translate(${text.x}px, ${text.y}px) rotate(${text.rotation}deg)`,
                  transformOrigin: '0 0',
                  '--tw-skew-x': `${text.skewX}deg`,
                  cursor: 'move'
                } as React.CSSProperties}
                onMouseDown={(e) => handleMouseDown(e, text.id)}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative" style={{ transform: `skewX(var(--tw-skew-x)) translate(-50%, -50%)` }}>
                  {isSelected && (
                    <div className="absolute -inset-4 border-2 border-brand-500 rounded-sm pointer-events-none z-50">
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-brand-500"></div>
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-brand-500"></div>
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-brand-500"></div>
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-brand-500"></div>
                    </div>
                  )}
                  <span
                    className={`${text.font} text-center uppercase whitespace-nowrap origin-center leading-none pointer-events-auto`}
                    style={{
                      color: text.color,
                      fontSize: `${text.fontSize}px`,
                      WebkitTextStroke: `${text.strokeWidth}px ${text.strokeColor}`,
                      paintOrder: 'stroke fill',
                      textShadow: text.shadow
                        ? `${text.shadowOffsetX}px ${text.shadowOffsetY}px ${text.shadowBlur}px ${shadowColorWithAlpha}`
                        : 'none'
                    }}
                  >
                    {text.text}
                  </span>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
