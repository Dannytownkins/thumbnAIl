
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image as ImageIcon, Youtube, Sparkles, Download, Eye, Key, Upload, Fingerprint, Layers, Type as TypeIcon, Trash2, Save, Box, AlignLeft, AlignCenter, AlignRight, MoveVertical, X, Copy, Sticker, Zap, Scissors, Check } from 'lucide-react';
import { Input, TextArea } from './components/Input';
import { Button } from './components/Button';
import { ConceptCard } from './components/ConceptCard';
import { ScanningLoader } from './components/Loader';
import { THUMBNAIL_STYLES, BRAND_FONTS, SAMPLE_BACKGROUNDS, COMMON_ASSETS } from './constants';
import { brainstormConcepts, generateThumbnailImage, analyzeImageStyle, generateLayer, isolateProductSubject } from './services/geminiService';
import { Concept, ThumbnailStyle, GeneratedImage, BrandProfile, CanvasState, AssetLayer, BrandFont, TextLayer } from './types';

// Constants for the Workspace
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ThumbnailStyle>(ThumbnailStyle.CLICKBAIT_SHOCKED);
  
  // Brand Profiles State
  const [savedProfiles, setSavedProfiles] = useState<BrandProfile[]>(() => {
    try {
      const saved = localStorage.getItem('thumbnail_profiles');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  
  // New State for Brand Analysis Staging
  const [analyzingState, setAnalyzingState] = useState<{
    isAnalyzing: boolean;
    previewUrl: string | null;
    detectedPrompt: string;
  }>({
    isAnalyzing: false,
    previewUrl: null,
    detectedPrompt: ''
  });
  
  // Background Library
  const [backgroundLibrary, setBackgroundLibrary] = useState<string[]>(() => {
     try {
        const saved = localStorage.getItem('background_library');
        return saved ? JSON.parse(saved) : SAMPLE_BACKGROUNDS;
     } catch (e) { return SAMPLE_BACKGROUNDS; }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const elementInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // Derived active profile
  const activeProfile = savedProfiles.find(p => p.id === activeProfileId);

  useEffect(() => {
    localStorage.setItem('thumbnail_profiles', JSON.stringify(savedProfiles));
  }, [savedProfiles]);

  useEffect(() => {
     localStorage.setItem('background_library', JSON.stringify(backgroundLibrary));
  }, [backgroundLibrary]);

  // Brainstorming State
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

  // --- CANVAS STATE ---
  const [activeTab, setActiveTab] = useState<'generate' | 'layers' | 'backgrounds' | 'elements'>('generate');
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
     backgroundUrl: null,
     product: null,
     elements: [],
     textLayers: [
       {
        id: 'text-1',
        text: 'YOUR TITLE',
        font: BrandFont.BEBAS_NEUE,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 8,
        fontSize: 250,
        letterSpacing: 0,
        skewX: -5,
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        rotation: 0,
        shadowColor: '#000000'
       }
     ]
  });

  // Scaling State for Preview
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(0.5);

  const updateScale = useCallback(() => {
    if (viewportRef.current) {
      const { clientWidth, clientHeight } = viewportRef.current;
      // We want to fit 1920x1080 into the available space with some padding
      const padding = 60;
      const availableWidth = clientWidth - padding;
      const availableHeight = clientHeight - padding;

      const scaleX = availableWidth / CANVAS_WIDTH;
      const scaleY = availableHeight / CANVAS_HEIGHT;
      
      // Use the smaller scale to ensure it fits entirely
      setScaleFactor(Math.min(scaleX, scaleY));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateScale);
    updateScale();
    const t = setTimeout(updateScale, 100); // Debounce initial render
    return () => {
        window.removeEventListener('resize', updateScale);
        clearTimeout(t);
    }
  }, [activeTab, generatedImage, updateScale]);

  // --- INTERACTION STATE ---
  const [selection, setSelection] = useState<{ type: 'product' | 'text' | 'element', id: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null); 
  // Offset of the object's center relative to the mouse cursor in Canvas Coordinates
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number } | null>(null);
  const [isIsolatingProduct, setIsIsolatingProduct] = useState(false);

  // --- EFFECTS & INIT ---

  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio && aiStudio.hasSelectedApiKey) {
        const hasKey = await aiStudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (selection) {
                if (selection.type === 'element') {
                    deleteElement(selection.id);
                } else if (selection.type === 'text') {
                    deleteTextLayer(selection.id);
                } else if (selection.type === 'product') {
                    setCanvasState(prev => ({ ...prev, product: null }));
                    setSelection(null);
                }
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection]);

  // --- API & ERROR HANDLING ---
  
  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.openSelectKey) {
      await aiStudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // --- HELPERS ---

  // Convert screen coordinates to 1920x1080 Canvas Coordinates
  // We need to account for the scale AND the centering offset of the 1920x1080 div within the viewport
  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
      const canvasElement = document.getElementById('canvas-root');
      if (!canvasElement) return { x: 0, y: 0 };

      const rect = canvasElement.getBoundingClientRect();
      
      // Position relative to the top-left of the SCALED canvas element
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      
      // Un-scale coordinates to get back to 1920x1080 space
      return { 
        x: relativeX / scaleFactor, 
        y: relativeY / scaleFactor 
      };
  }, [scaleFactor]);

  // --- BRAND PROFILE HANDLERS ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      // Move to Staging
      setAnalyzingState({
        isAnalyzing: true,
        previewUrl: base64String,
        detectedPrompt: 'Extracting visual style, please wait...'
      });

      const base64Data = base64String.split(',')[1];
      const mimeType = file.type;

      try {
        const styleDescription = await analyzeImageStyle(base64Data, mimeType);
        setAnalyzingState(prev => ({
          ...prev,
          isAnalyzing: false,
          detectedPrompt: styleDescription
        }));
      } catch (e) {
        console.error("Style analysis failed:", e);
        alert("Style analysis failed.");
        setAnalyzingState(prev => ({ ...prev, isAnalyzing: false, detectedPrompt: 'Analysis failed.' }));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const saveBrandProfile = () => {
    if (!analyzingState.detectedPrompt || !analyzingState.previewUrl) return;
    
    const newProfile: BrandProfile = {
      id: crypto.randomUUID(),
      name: `Brand Style ${savedProfiles.length + 1}`,
      styleDescription: analyzingState.detectedPrompt,
      referenceImageUrl: analyzingState.previewUrl
    };
    
    setSavedProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setAnalyzingState({ isAnalyzing: false, previewUrl: null, detectedPrompt: '' });
  };

  const cancelBrandAnalysis = () => {
    setAnalyzingState({ isAnalyzing: false, previewUrl: null, detectedPrompt: '' });
  };

  // --- GENERATION HANDLERS ---

  const handleBrainstorm = async () => {
    if (!topic.trim()) return;
    setIsBrainstorming(true);
    setConcepts([]);
    try {
      const results = await brainstormConcepts(
        topic, 
        selectedStyle, 
        activeProfile?.styleDescription
      );
      setConcepts(results);
    } catch (e) {
      console.error("Brainstorming failed:", e);
      alert("Brainstorming failed. Please check your API Key.");
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleGenerateImage = async (concept: Concept) => {
    setIsGenerating(true);
    try {
      const productBase64 = canvasState.product?.sourceImage || canvasState.product?.url;

      const imageUrl = await generateThumbnailImage(
        concept, 
        selectedStyle, 
        false, 
        activeProfile?.styleDescription,
        productBase64
      );
      
      const newGenImage = {
        id: crypto.randomUUID(),
        url: imageUrl,
        prompt: concept.visualDescription,
        conceptId: concept.id,
        timestamp: Date.now(),
        layers: {}
      };

      setGeneratedImage(newGenImage);

      setCanvasState(prev => ({
         ...prev,
         backgroundUrl: imageUrl,
         textLayers: prev.textLayers.length > 0 
           ? prev.textLayers.map((l, i) => i === 0 ? { ...l, text: concept.hookText || l.text } : l)
           : [{
              id: crypto.randomUUID(),
              text: concept.hookText || "VIRAL TITLE",
              font: BrandFont.BEBAS_NEUE,
              color: '#ffffff',
              strokeColor: '#000000',
              strokeWidth: 8,
              fontSize: 250,
              letterSpacing: 0,
              skewX: -5,
              x: CANVAS_WIDTH / 2,
              y: CANVAS_HEIGHT / 2,
              rotation: 0,
              shadowColor: '#000000'
           }]
      }));
      
      setActiveTab('layers');

    } catch (e) {
      console.error("Image generation failed:", e);
      alert("Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSplitLayers = async () => {
     if (!generatedImage) return;
     setIsSplitting(true);

     const concept = concepts.find(c => c.id === generatedImage.conceptId) || concepts[0];

     try {
        const bgUrl = await generateLayer(concept, 'background', generatedImage.url);
        const subjectGreenUrl = await generateLayer(concept, 'subject', generatedImage.url);
        
        const img = new Image();
        img.src = subjectGreenUrl;
        img.crossOrigin = "anonymous";
        img.onload = () => {
           const canvas = document.createElement('canvas');
           canvas.width = img.width;
           canvas.height = img.height;
           const ctx = canvas.getContext('2d');
           if (ctx) {
              ctx.drawImage(img, 0, 0);
              chromaKeyGreen(ctx, canvas.width, canvas.height);
              const transparentUrl = canvas.toDataURL('image/png');
              
              setCanvasState(prev => ({
                 ...prev,
                 backgroundUrl: bgUrl,
                 product: {
                    id: crypto.randomUUID(),
                    type: 'product',
                    url: transparentUrl,
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    scale: 1,
                    rotation: 0,
                    glow: false,
                    glowColor: '#ffffff',
                    shadow: true,
                    strokeWidth: 0,
                    strokeColor: '#ffffff'
                 }
              }));
           }
        };
     } catch(e) {
        console.error("Layer splitting failed:", e);
        alert("Layer splitting failed.");
     } finally {
        setIsSplitting(false);
     }
  };

  // --- ASSET HANDLERS ---

  const chromaKeyGreen = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
     const imgData = ctx.getImageData(0, 0, width, height);
     const data = imgData.data;
     for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (g > 100 && g > r * 1.4 && g > b * 1.4) {
           data[i + 3] = 0; 
        }
     }
     ctx.putImageData(imgData, 0, 0);
  };

  const handleProductUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;
     setIsIsolatingProduct(true);
     const reader = new FileReader();
     reader.onloadend = async () => {
        try {
           const base64 = reader.result as string;
           const base64Raw = base64.split(',')[1];
           const greenScreenImage = await isolateProductSubject(base64Raw);
           const img = new Image();
           img.src = greenScreenImage;
           img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              let newProductId = crypto.randomUUID();

              if (ctx) {
                 ctx.drawImage(img, 0, 0);
                 chromaKeyGreen(ctx, canvas.width, canvas.height);
                 const transparentUrl = canvas.toDataURL('image/png');
                 
                 setCanvasState(prev => ({
                    ...prev,
                    product: {
                       id: newProductId,
                       type: 'product',
                       url: transparentUrl,
                       sourceImage: base64,
                       x: CANVAS_WIDTH / 2,
                       y: CANVAS_HEIGHT / 2,
                       scale: 1,
                       rotation: 0,
                       glow: false,
                       glowColor: '#ffffff',
                       shadow: true,
                       strokeWidth: 0,
                       strokeColor: '#ffffff'
                    }
                 }));
                 setSelection({ type: 'product', id: newProductId });
                 setActiveTab('layers');
              }
              setIsIsolatingProduct(false);
           };
        } catch (e) {
           console.error("Product isolation failed:", e);
           alert("Product isolation failed.");
           setIsIsolatingProduct(false);
        }
     };
     reader.readAsDataURL(file);
  };

  const addElement = (url: string) => {
      const newElement: AssetLayer = {
          id: crypto.randomUUID(),
          type: 'element',
          url: url,
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          scale: 0.8,
          rotation: 0,
          glow: false,
          glowColor: '#ffffff',
          shadow: false,
          strokeWidth: 0,
          strokeColor: '#ffffff'
      };
      setCanvasState(prev => ({
          ...prev,
          elements: [...prev.elements, newElement]
      }));
      setSelection({ type: 'element', id: newElement.id });
      setActiveTab('layers');
  };

  const handleElementUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onloadend = () => {
        addElement(reader.result as string);
     };
     reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onloadend = () => {
        const url = reader.result as string;
        setBackgroundLibrary(prev => [url, ...prev]);
        setCanvasState(prev => ({ ...prev, backgroundUrl: url }));
     };
     reader.readAsDataURL(file);
  };

  const updateElement = (id: string, updates: Partial<AssetLayer>) => {
      setCanvasState(prev => ({
          ...prev,
          elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el)
      }));
  };

  const deleteElement = (id: string) => {
      setCanvasState(prev => ({
          ...prev,
          elements: prev.elements.filter(el => el.id !== id)
      }));
      if (selection?.id === id) setSelection(null);
  };

  const addTextLayer = () => {
    const newText: TextLayer = {
      id: crypto.randomUUID(),
      text: 'NEW TEXT',
      font: BrandFont.BEBAS_NEUE,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 8,
      fontSize: 150,
      letterSpacing: 0,
      skewX: 0,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      rotation: 0,
      shadowColor: '#000000'
    };
    setCanvasState(prev => ({
      ...prev,
      textLayers: [...prev.textLayers, newText]
    }));
    setSelection({ type: 'text', id: newText.id });
    setActiveTab('layers');
  };

  const duplicateTextLayer = (layer: TextLayer) => {
    const newText = {
        ...layer,
        id: crypto.randomUUID(),
        x: layer.x + 40,
        y: layer.y + 40,
    };
    setCanvasState(prev => ({
        ...prev,
        textLayers: [...prev.textLayers, newText]
    }));
    setSelection({ type: 'text', id: newText.id });
  };

  const updateTextLayer = (id: string, updates: Partial<TextLayer>) => {
    setCanvasState(prev => ({
      ...prev,
      textLayers: prev.textLayers.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  };

  const deleteTextLayer = (id: string) => {
    setCanvasState(prev => ({
      ...prev,
      textLayers: prev.textLayers.filter(l => l.id !== id)
    }));
    if (selection?.id === id) setSelection(null);
  };

  // --- EXPORT LOGIC (CANVAS) ---

  const handleExport = () => {
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
       // 1. Background (Z-0)
       if (canvasState.backgroundUrl) {
          try {
            const bg = await loadImage(canvasState.backgroundUrl);
            // Cover mode
            const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
            const x = (canvas.width / 2) - (bg.width / 2) * scale;
            const y = (canvas.height / 2) - (bg.height / 2) * scale;
            ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);
          } catch(e) { console.error("Failed to load background for export", e) }
       } else {
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
       }

       // Helper to draw any asset layer
       const drawAsset = async (asset: AssetLayer) => {
          try {
            const img = await loadImage(asset.url);
            const width = img.width;
            const height = img.height;
            const scale = asset.scale;
            
            ctx.save();
            ctx.translate(asset.x, asset.y);
            ctx.scale(scale, scale);
            ctx.rotate((asset.rotation * Math.PI) / 180);

            // Shadow
            if (asset.shadow) {
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 30;
              ctx.shadowOffsetX = 10;
              ctx.shadowOffsetY = 10;
            }
            
            // Glow (Applied as shadow with 0 offset)
            if (asset.glow) {
              const tempCtx = ctx; 
              tempCtx.shadowColor = asset.glowColor || '#ffffff';
              tempCtx.shadowBlur = 40;
              tempCtx.shadowOffsetX = 0;
              tempCtx.shadowOffsetY = 0;
            }

            ctx.drawImage(img, -width/2, -height/2);
            ctx.restore();
          } catch(e) { console.error("Failed to load asset for export", e); }
       };

       // 2. Product (Z-10)
       if (canvasState.product) {
          await drawAsset(canvasState.product);
       }

       // 3. Elements (Z-20)
       for (const el of canvasState.elements) {
           await drawAsset(el);
       }

       // 4. Text Layers (Z-30)
       try { await document.fonts.ready; } catch(e) {}

       for (const text of canvasState.textLayers) {
          ctx.save();
          ctx.translate(text.x, text.y);
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
          
          // Text Shadow
          ctx.shadowColor = text.shadowColor;
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;

          // Stroke - Draw BEHIND fill
          if (text.strokeWidth > 0) {
            ctx.lineWidth = text.strokeWidth * 2; 
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeStyle = text.strokeColor;
            ctx.strokeText(text.text, 0, 0);
          }

          ctx.fillStyle = text.color;
          ctx.fillText(text.text, 0, 0);
          ctx.restore();
       }

       const link = document.createElement('a');
       link.download = `slingmods-thumbnail-${Date.now()}.png`;
       link.href = canvas.toDataURL('image/png');
       link.click();
    };

    drawComposite();
  };

  // --- CANVAS INTERACTION CORE ---

  const handleMouseDown = (e: React.MouseEvent, type: 'product' | 'text' | 'element', id: string) => {
      e.stopPropagation(); 
      e.preventDefault(); // Prevents native drag, ensures custom drag works
      
      // 1. Select immediately
      setSelection({ type, id });
      setActiveTab('layers');

      // 2. Setup Dragging
      const { x: mouseCanvasX, y: mouseCanvasY } = getCanvasCoordinates(e.clientX, e.clientY);
      
      // Find object current pos
      let objX = 0;
      let objY = 0;
      
      if (type === 'product' && canvasState.product) {
          objX = canvasState.product.x;
          objY = canvasState.product.y;
      } else if (type === 'text') {
          const t = canvasState.textLayers.find(l => l.id === id);
          if (t) { objX = t.x; objY = t.y; }
      } else if (type === 'element') {
          const el = canvasState.elements.find(el => el.id === id);
          if (el) { objX = el.x; objY = el.y; }
      }

      setDragStart({ x: e.clientX, y: e.clientY });
      setDragOffset({ x: mouseCanvasX - objX, y: mouseCanvasY - objY });
  };

  const handleWindowMouseMove = (e: MouseEvent) => {
     if (!selection || !dragStart || !dragOffset) return;

     // Drag Threshold Check (5px)
     if (!isDragging) {
        const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
        if (dist > 5) {
            setIsDragging(true);
        } else {
            return; // Don't move yet
        }
     }

     const { x: mouseX, y: mouseY } = getCanvasCoordinates(e.clientX, e.clientY);
     const newX = mouseX - dragOffset.x;
     const newY = mouseY - dragOffset.y;

     if (selection.type === 'product') {
         setCanvasState(prev => ({ ...prev, product: { ...prev.product!, x: newX, y: newY } }));
     } else if (selection.type === 'text') {
         updateTextLayer(selection.id, { x: newX, y: newY });
     } else if (selection.type === 'element') {
         updateElement(selection.id, { x: newX, y: newY });
     }
  };

  const handleWindowMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setDragOffset(null);
      // Note: We do NOT clear selection here. Selection persists until background click.
  };

  // Attach global listeners for smooth dragging outside canvas bounds
  useEffect(() => {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
      }
  }, [selection, dragStart, dragOffset, isDragging, scaleFactor]);


  const handleBackgroundClick = () => {
      setSelection(null);
  };

  // --- RENDER HELPERS ---

  const renderAssetControls = (asset: AssetLayer, isProduct: boolean) => {
    const handleAlign = (type: 'left' | 'center' | 'right' | 'middle') => {
        let newX = asset.x;
        let newY = asset.y;
        
        if (type === 'left') newX = CANVAS_WIDTH * 0.25;
        if (type === 'center') newX = CANVAS_WIDTH * 0.5;
        if (type === 'right') newX = CANVAS_WIDTH * 0.75;
        if (type === 'middle') newY = CANVAS_HEIGHT * 0.5;

        if (isProduct) {
            setCanvasState(prev => ({ ...prev, product: { ...prev.product!, x: newX, y: newY } }));
        } else {
            updateElement(asset.id, { x: newX, y: newY });
        }
    };

    return (
      <div className="bg-dark-900 border border-dark-800 rounded-2xl p-5 space-y-4 relative animate-in fade-in slide-in-from-right-4 duration-200">
           {isProduct ? (
               <h3 className="text-xs font-bold text-brand-400 uppercase flex items-center"><Box className="w-3 h-3 mr-2"/>Main Product (Z:10)</h3>
           ) : (
               <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-blue-400 uppercase flex items-center"><Sticker className="w-3 h-3 mr-2"/>Element Layer (Z:20)</h3>
                  <button onClick={() => deleteElement(asset.id)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
               </div>
           )}
           
           <div className="grid grid-cols-4 gap-2">
               <Button variant="secondary" size="sm" onClick={() => handleAlign('left')} title="Align Left Third" className="px-0"><AlignLeft className="w-4 h-4"/></Button>
               <Button variant="secondary" size="sm" onClick={() => handleAlign('center')} title="Align Center" className="px-0"><AlignCenter className="w-4 h-4"/></Button>
               <Button variant="secondary" size="sm" onClick={() => handleAlign('right')} title="Align Right Third" className="px-0"><AlignRight className="w-4 h-4"/></Button>
               <Button variant="secondary" size="sm" onClick={() => handleAlign('middle')} title="Center Vertically" className="px-0"><MoveVertical className="w-4 h-4"/></Button>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                  <span className="text-xs text-gray-400">Scale</span>
                  <input 
                      type="range" min="0.1" max="3" step="0.1" 
                      value={asset.scale}
                      onChange={(e) => isProduct 
                          ? setCanvasState(prev => ({ ...prev, product: { ...prev.product!, scale: parseFloat(e.target.value) } }))
                          : updateElement(asset.id, { scale: parseFloat(e.target.value) })
                      }
                      className="w-full accent-brand-500"
                  />
              </div>
              <div className="space-y-1">
                  <span className="text-xs text-gray-400">Rotation</span>
                  <input 
                      type="range" min="-180" max="180" step="1" 
                      value={asset.rotation}
                      onChange={(e) => isProduct 
                          ? setCanvasState(prev => ({ ...prev, product: { ...prev.product!, rotation: parseInt(e.target.value) } }))
                          : updateElement(asset.id, { rotation: parseInt(e.target.value) })
                      }
                      className="w-full accent-brand-500"
                  />
              </div>
           </div>

           <div className="pt-2 border-t border-dark-800 space-y-3">
               <div className="flex items-center justify-between">
                   <label className="flex items-center text-xs text-gray-300 cursor-pointer">
                      <input 
                         type="checkbox" 
                         checked={asset.shadow}
                         onChange={(e) => isProduct
                            ? setCanvasState(prev => ({ ...prev, product: { ...prev.product!, shadow: e.target.checked } }))
                            : updateElement(asset.id, { shadow: e.target.checked })
                         }
                         className="mr-2 rounded bg-dark-700 border-dark-600 text-brand-600 focus:ring-0"
                      />
                      Drop Shadow
                   </label>
               </div>

               <div className="flex items-center gap-2">
                   <label className="flex items-center text-xs text-gray-300 cursor-pointer flex-1">
                      <input 
                         type="checkbox" 
                         checked={asset.glow}
                         onChange={(e) => isProduct
                            ? setCanvasState(prev => ({ ...prev, product: { ...prev.product!, glow: e.target.checked } }))
                            : updateElement(asset.id, { glow: e.target.checked })
                         }
                         className="mr-2 rounded bg-dark-700 border-dark-600 text-brand-600 focus:ring-0"
                      />
                      Outer Glow
                   </label>
                   <input 
                      type="color" 
                      value={asset.glowColor || '#ffffff'}
                      onChange={(e) => isProduct
                          ? setCanvasState(prev => ({ ...prev, product: { ...prev.product!, glowColor: e.target.value } }))
                          : updateElement(asset.id, { glowColor: e.target.value })
                      }
                      className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer disabled:opacity-50"
                      disabled={!asset.glow}
                   />
               </div>
            </div>
        </div>
    );
  };
  
  const renderTextControls = (text: TextLayer) => {
    return (
      <div className="bg-dark-900 border border-dark-800 rounded-2xl p-5 space-y-4 relative animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-green-400 uppercase flex items-center"><TypeIcon className="w-3 h-3 mr-2"/>Text Layer (Z:30)</h3>
          <div>
            <button onClick={() => duplicateTextLayer(text)} className="text-gray-500 hover:text-green-400 mr-2"><Copy className="w-4 h-4" /></button>
            <button onClick={() => deleteTextLayer(text.id)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        
        <TextArea 
            value={text.text}
            onChange={e => updateTextLayer(text.id, { text: e.target.value })}
            className="text-lg"
        />

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <span className="text-xs text-gray-400">Font</span>
                <select 
                    value={text.font}
                    onChange={e => updateTextLayer(text.id, { font: e.target.value as BrandFont })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                >
                    {BRAND_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
            </div>
            <div className="space-y-1">
                <span className="text-xs text-gray-400">Color</span>
                <input 
                    type="color" 
                    value={text.color}
                    onChange={e => updateTextLayer(text.id, { color: e.target.value })}
                    className="w-full h-9 p-0 bg-transparent border-none rounded cursor-pointer"
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                  <span className="text-xs text-gray-400">Font Size</span>
                  <input 
                      type="range" min="20" max="600" step="5" 
                      value={text.fontSize}
                      onChange={e => updateTextLayer(text.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full accent-brand-500"
                  />
              </div>
              <div className="space-y-1">
                  <span className="text-xs text-gray-400">Rotation</span>
                  <input 
                      type="range" min="-45" max="45" step="1" 
                      value={text.rotation}
                      onChange={e => updateTextLayer(text.id, { rotation: parseInt(e.target.value) })}
                      className="w-full accent-brand-500"
                  />
              </div>
        </div>
        
        <div className="pt-2 border-t border-dark-800 space-y-3">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <span className="text-xs text-gray-400">Stroke</span>
                    <input 
                        type="range" min="0" max="40" step="1" 
                        value={text.strokeWidth}
                        onChange={e => updateTextLayer(text.id, { strokeWidth: parseInt(e.target.value) })}
                        className="w-full accent-brand-500"
                    />
                </div>
                <div className="space-y-1">
                    <span className="text-xs text-gray-400">Stroke Color</span>
                    <input 
                        type="color" 
                        value={text.strokeColor}
                        onChange={e => updateTextLayer(text.id, { strokeColor: e.target.value })}
                        className="w-full h-9 p-0 bg-transparent border-none rounded cursor-pointer"
                    />
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- RENDER ---

  if (!hasApiKey) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-dark-950 p-8 text-center">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-900/20 via-transparent to-transparent -z-10"></div>
        <div className="max-w-2xl">
          <h1 className="text-6xl font-anton text-white tracking-wider mb-2">Thumbn<span className="text-brand-500">AI</span>l Studio</h1>
          <p className="text-xl text-gray-400 mb-8">Professional-Grade AI YouTube Thumbnail Generator</p>
          <div className="p-6 bg-dark-900 border border-dark-800 rounded-xl space-y-4">
              <div className="flex items-start gap-4 text-left">
                  <Key className="w-8 h-8 text-brand-500 mt-1 shrink-0" />
                  <div>
                      <h2 className="text-lg font-bold text-white">API Key Required</h2>
                      <p className="text-gray-400 text-sm">
                          To generate high-quality images with Gemini 3 Pro, you'll need an API key from a Google Cloud project with billing enabled.
                      </p>
                  </div>
              </div>
              <Button onClick={handleSelectKey} size="lg" className="w-full mt-4">
                  Select Your Gemini API Key
              </Button>
          </div>
        </div>
      </div>
    );
  }

  const selectedLayer = selection ? 
    (selection.type === 'product' ? canvasState.product : 
    (selection.type === 'element' ? canvasState.elements.find(e => e.id === selection.id) : 
    canvasState.textLayers.find(t => t.id === selection.id))) 
    : null;

  return (
    <div className="min-h-screen bg-dark-950 flex font-sans antialiased text-gray-200 overflow-hidden select-none">
      {/* --- LEFT PANEL: Generation --- */}
      <aside className="w-[400px] bg-dark-900 flex flex-col border-r border-dark-800 h-screen z-10 shadow-2xl">
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
          <div className="space-y-3 pb-6 border-b border-dark-800">
              <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center"><Fingerprint className="w-4 h-4 mr-2"/>Brand Identity</h2>
              
              {/* Analyzer Staging Area */}
              {analyzingState.isAnalyzing || analyzingState.detectedPrompt || analyzingState.previewUrl ? (
                <div className="bg-dark-800 border border-brand-500/30 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-medium text-brand-400">Analysis Staging</span>
                        <button onClick={cancelBrandAnalysis}><X className="w-4 h-4 text-gray-500 hover:text-white"/></button>
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

                    <TextArea 
                        label="Detected Style Prompt"
                        value={analyzingState.detectedPrompt}
                        onChange={(e) => setAnalyzingState(prev => ({...prev, detectedPrompt: e.target.value}))}
                        className="text-xs font-mono h-24"
                        placeholder="AI is analyzing..."
                    />
                    
                    <Button size="sm" className="w-full" onClick={saveBrandProfile} disabled={analyzingState.isAnalyzing} icon={<Check className="w-3 h-3"/>}>
                        Save as New Profile
                    </Button>
                </div>
              ) : (
                <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 space-y-3">
                  <select 
                      value={activeProfileId || ''}
                      onChange={(e) => setActiveProfileId(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none"
                  >
                      <option value="">Default / No Style</option>
                      {savedProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} icon={<Upload className="w-3 h-3"/>}>
                      Analyze New Style
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*"/>
                </div>
              )}
          </div>
          
          {/* Generation Form */}
          <div className="space-y-3">
              <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center"><Youtube className="w-4 h-4 mr-2"/>Video Details</h2>
              <Input 
                  label="Video Topic or Title"
                  placeholder="e.g., 'Slingmods 2025 Product Reveal'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
              />
              <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Thumbnail Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {THUMBNAIL_STYLES.map(style => (
                      <button 
                        key={style.value}
                        onClick={() => setSelectedStyle(style.value)}
                        className={`p-2 rounded-lg text-left text-xs transition-all border ${selectedStyle === style.value ? 'bg-brand-600/20 border-brand-500 text-white' : 'bg-dark-800 border-dark-700 hover:border-dark-600 text-gray-400'}`}
                      >
                        <span className="mr-2">{style.icon}</span>{style.label.split(' ')[1]}
                      </button>
                    ))}
                  </div>
              </div>
              <Button onClick={handleBrainstorm} isLoading={isBrainstorming} className="w-full h-12 text-lg" size="md" icon={<Sparkles className="w-5 h-5"/>}>
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
                      onGenerate={handleGenerateImage}
                      onUpdate={(id, updates) => setConcepts(prev => prev.map(p => p.id === id ? {...p, ...updates} : p))}
                      isGenerating={isGenerating}
                  />
              ))}
          </div>
        </div>
      </aside>

      {/* --- CENTER PANEL: Workspace --- */}
      <main className="flex-1 bg-dark-950 flex flex-col relative overflow-hidden">
        
        {/* Top Bar */}
        <div className="h-14 border-b border-dark-800 bg-dark-900 flex items-center justify-between px-4 shrink-0 z-20">
           <div className="flex items-center space-x-4 text-gray-400 text-sm">
               <span>{CANVAS_WIDTH} x {CANVAS_HEIGHT}</span>
               <span className="text-dark-700">|</span>
               <span>{Math.round(scaleFactor * 100)}% Zoom</span>
           </div>
           <div className="flex gap-2">
             {generatedImage && (
                <Button variant="secondary" size="sm" onClick={handleSplitLayers} isLoading={isSplitting} icon={<Scissors className="w-4 h-4"/>}>
                  Auto-Split Layers
                </Button>
             )}
             <Button onClick={handleExport} size="sm" icon={<Download className="w-4 h-4"/>}>Export PNG</Button>
           </div>
        </div>

        {/* 
            Viewport Container: 
            This div takes up all remaining space. 
            We use flexbox to center the canvas.
        */}
        <div 
            className="flex-1 relative flex items-center justify-center bg-black overflow-hidden p-8" 
            ref={viewportRef} 
            onClick={handleBackgroundClick}
        >
            
            {/* 
                Scaled Canvas Root: 
                This div is STRICTLY 1920x1080.
                We scale it down using CSS transform to fit the viewport.
            */}
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
                {/* LAYER 0: Background (z-0) */}
                <div className="absolute inset-0 z-0 pointer-events-none select-none">
                    {canvasState.backgroundUrl ? 
                      <img src={canvasState.backgroundUrl} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center text-dark-700 font-mono text-4xl">EMPTY CANVAS</div>
                    }
                </div>

                {/* LAYER 1: Product (z-10) */}
                {canvasState.product && (
                    <div 
                      className="absolute top-0 left-0 z-10"
                      style={{
                          transform: `translate(${canvasState.product.x}px, ${canvasState.product.y}px) rotate(${canvasState.product.rotation}deg) scale(${canvasState.product.scale})`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'product', canvasState.product!.id)}
                      onClick={(e) => e.stopPropagation()} 
                    >
                      <img 
                          src={canvasState.product.url} 
                          className={`block max-w-none pointer-events-auto cursor-grab active:cursor-grabbing ${selection?.id === canvasState.product.id ? 'outline outline-4 outline-brand-500' : ''}`}
                          style={{ 
                            transform: 'translate(-50%, -50%)', 
                            filter: canvasState.product.shadow ? `drop-shadow(10px 10px 20px rgba(0,0,0,0.8))` : 'none'
                          }} 
                          draggable={false}
                      />
                      {/* Glow effect overlay */}
                      {canvasState.product.glow && (
                          <img 
                            src={canvasState.product.url}
                            className="absolute top-0 left-0 pointer-events-none"
                            style={{
                                transform: 'translate(-50%, -50%)',
                                filter: `drop-shadow(0px 0px 20px ${canvasState.product.glowColor}) drop-shadow(0px 0px 40px ${canvasState.product.glowColor})`,
                                opacity: 0.8,
                                zIndex: -1
                            }}
                          />
                      )}
                    </div>
                )}

                {/* LAYER 2: Elements (z-20) */}
                {canvasState.elements.map(el => (
                    <div
                      key={el.id}
                      className="absolute top-0 left-0 z-20"
                      style={{
                          transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg) scale(${el.scale})`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'element', el.id)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* 
                          Important: Elements are often small icons. 
                          We wrap them to ensure they have a hit box. 
                      */}
                      <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
                          <img 
                              src={el.url} 
                              className={`block max-w-none pointer-events-auto cursor-grab active:cursor-grabbing ${selection?.id === el.id ? 'outline outline-4 outline-blue-500' : ''}`}
                              style={{ 
                                  filter: el.shadow ? `drop-shadow(10px 10px 20px rgba(0,0,0,0.8))` : 'none',
                                  minWidth: '50px', minHeight: '50px' // Ensure visibility
                              }} 
                              draggable={false}
                          />
                          {el.glow && (
                              <img 
                                src={el.url}
                                className="absolute top-0 left-0 pointer-events-none"
                                style={{
                                    filter: `drop-shadow(0px 0px 20px ${el.glowColor}) drop-shadow(0px 0px 40px ${el.glowColor})`,
                                    opacity: 0.8,
                                    zIndex: -1
                                }}
                              />
                          )}
                      </div>
                    </div>
                ))}

                {/* LAYER 3: Text (z-30) */}
                {canvasState.textLayers.map(text => (
                    <div
                        key={text.id}
                        className="absolute top-0 left-0 z-30 flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing"
                        style={{
                            transform: `translate(${text.x}px, ${text.y}px) rotate(${text.rotation}deg)`,
                            transformOrigin: '0 0',
                            '--tw-skew-x': `${text.skewX}deg`
                        } as React.CSSProperties}
                        onMouseDown={(e) => handleMouseDown(e, 'text', text.id)}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span
                            className={`${text.font} text-center uppercase whitespace-nowrap origin-center leading-none select-none ${selection?.id === text.id ? 'outline outline-4 outline-green-500' : ''}`}
                            style={{
                              color: text.color,
                              fontSize: `${text.fontSize}px`,
                              WebkitTextStroke: `${text.strokeWidth}px ${text.strokeColor}`,
                              paintOrder: 'stroke fill',
                              transform: `skewX(var(--tw-skew-x)) translate(-50%, -50%)`,
                              textShadow: `0 4px 8px ${text.shadowColor}`
                            }}
                        >
                            {text.text}
                        </span>
                    </div>
                ))}
            </div>
        </div>
      </main>

      {/* --- RIGHT PANEL: Properties & Assets --- */}
      <aside className="w-[380px] bg-dark-900 flex flex-col border-l border-dark-800 h-screen z-10 shadow-2xl">
          <div className="flex p-2 bg-dark-950 border-b border-dark-800 shrink-0 gap-1">
             <button onClick={() => setActiveTab('layers')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'layers' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><Layers className="w-4 h-4 mr-2"/>Layers</button>
             <button onClick={() => setActiveTab('elements')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'elements' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><Sticker className="w-4 h-4 mr-2"/>Elements</button>
             <button onClick={() => setActiveTab('backgrounds')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'backgrounds' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><ImageIcon className="w-4 h-4 mr-2"/>BGs</button>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar bg-dark-900/50">
              {activeTab === 'layers' && (
                <div className="space-y-4">
                  {selection && selectedLayer ? (
                      selection.type === 'text' ? renderTextControls(selectedLayer as TextLayer) : renderAssetControls(selectedLayer as AssetLayer, selection.type === 'product')
                  ) : <div className="text-center text-gray-500 text-sm p-8 bg-dark-800/30 rounded-lg border border-dashed border-dark-700">Click an item on the canvas to edit properties.</div>}

                  <div className="pt-4 border-t border-dark-800 space-y-3">
                    {!canvasState.product && (
                        <div className="p-4 bg-dark-800 rounded-lg border border-dark-700 group hover:border-brand-500 transition-colors">
                        <Button className="w-full" variant="secondary" size="sm" icon={<Box className="w-4 h-4" />} onClick={() => productInputRef.current?.click()} isLoading={isIsolatingProduct}>
                            {isIsolatingProduct ? 'Isolating Subject...' : 'Upload Product / Subject'}
                        </Button>
                        <input type="file" ref={productInputRef} onChange={handleProductUpload} className="hidden" accept="image/*" />
                        <p className="text-[10px] text-gray-500 mt-2 text-center">Supports auto-background removal</p>
                        </div>
                    )}
                    
                    <Button className="w-full" variant="ghost" size="sm" onClick={addTextLayer} icon={<TypeIcon className="w-4 h-4"/>}>Add New Text Layer</Button>
                  </div>
                </div>
              )}
              
              {activeTab === 'backgrounds' && (
                <div className="space-y-3">
                  <Button variant="secondary" className="w-full" onClick={() => backgroundInputRef.current?.click()} icon={<Upload className="w-4 h-4"/>}>Upload Background</Button>
                  <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                  <div className="grid grid-cols-2 gap-2">
                      {backgroundLibrary.map(bg => (
                        <div key={bg} className="relative aspect-video rounded-md overflow-hidden cursor-pointer group border border-dark-700 hover:border-brand-500" onClick={() => setCanvasState(prev => ({...prev, backgroundUrl: bg}))}>
                            <img src={bg} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-6 h-6 text-white"/>
                            </div>
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
                             <button key={item} onClick={() => addElement(item)} className="bg-dark-800 p-2 rounded-md aspect-square flex items-center justify-center hover:bg-dark-700 transition-colors border border-dark-700 hover:border-brand-500">
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
    </div>
  );
}
