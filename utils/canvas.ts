import { CanvasState, ImageLayer, TextLayer } from '../types';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const hexToRgba = (hex: string, alpha: number) => {
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

export const exportCanvas = (canvasState: CanvasState) => {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });

  const drawComposite = async () => {
    // 1. Background
    if (canvasState.backgroundType === 'gradient') {
      const { color1, color2, direction } = canvasState.backgroundGradient;
      let grad;
      const w = canvas.width;
      const h = canvas.height;

      if (direction === 'to right') grad = ctx.createLinearGradient(0, 0, w, 0);
      else if (direction === 'to bottom') grad = ctx.createLinearGradient(0, 0, 0, h);
      else if (direction === 'to bottom right') grad = ctx.createLinearGradient(0, 0, w, h);
      else if (direction === 'to top right') grad = ctx.createLinearGradient(0, h, w, 0);
      else grad = ctx.createLinearGradient(0, 0, 0, h);

      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    else if (canvasState.backgroundType === 'image' && canvasState.backgroundUrl) {
      try {
        const bg = await loadImage(canvasState.backgroundUrl);
        const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
        const x = (canvas.width / 2) - (bg.width / 2) * scale;
        const y = (canvas.height / 2) - (bg.height / 2) * scale;
        ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);
      } catch(e) { console.error("Failed to load background for export", e) }
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Unified Layers Loop
    try { await document.fonts.ready; } catch(e) {}

    for (const layer of canvasState.layers) {
      if (!layer.visible) continue;

      ctx.save();
      ctx.translate(layer.x, layer.y);

      if (layer.type === 'image') {
        const imgLayer = layer as ImageLayer;
        try {
          const img = await loadImage(imgLayer.url);
          ctx.scale(imgLayer.scale, imgLayer.scale);
          ctx.rotate((imgLayer.rotation * Math.PI) / 180);

          if (imgLayer.shadow) {
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 10;
            ctx.shadowOffsetY = 10;
          }

          if (imgLayer.glow) {
            ctx.shadowColor = imgLayer.glowColor;
            ctx.shadowBlur = 40;
          }

          ctx.drawImage(img, -img.width/2, -img.height/2);
        } catch(e) {}
      }
      else if (layer.type === 'text') {
        const text = layer as TextLayer;
        const skewRad = (text.skewX * Math.PI) / 180;
        ctx.transform(1, 0, Math.tan(skewRad), 1, 0, 0);
        ctx.rotate((text.rotation * Math.PI) / 180);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let fontFamily = 'Inter';
        if (text.font.includes('bebas')) fontFamily = '"Bebas Neue"';
        if (text.font.includes('anton')) fontFamily = 'Anton';
        if (text.font.includes('montserrat')) fontFamily = 'Montserrat';
        if (text.font.includes('roboto')) fontFamily = '"Roboto Condensed"';

        ctx.font = `900 ${text.fontSize}px ${fontFamily}`;

        if (text.shadow) {
          ctx.shadowColor = hexToRgba(text.shadowColor, text.shadowOpacity);
          ctx.shadowBlur = text.shadowBlur;
          ctx.shadowOffsetX = text.shadowOffsetX;
          ctx.shadowOffsetY = text.shadowOffsetY;
        } else {
          ctx.shadowColor = 'transparent';
        }

        if (text.strokeWidth > 0) {
          ctx.lineWidth = text.strokeWidth * 2;
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.strokeStyle = text.strokeColor;
          ctx.strokeText(text.text, 0, 0);
        }

        ctx.fillStyle = text.color;
        ctx.fillText(text.text, 0, 0);
      }

      ctx.restore();
    }

    const link = document.createElement('a');
    link.download = `thumbnAIl-export-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  drawComposite();
};
