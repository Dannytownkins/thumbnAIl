
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image as ImageIcon, Youtube, Sparkles, Download, Eye, Key, Upload, Fingerprint, Layers, Type as TypeIcon, Trash2, Box, AlignLeft, AlignCenter, AlignRight, MoveVertical, X, Copy, Sticker, Zap, Scissors, Check, PaintBucket, ArrowRight, ArrowDown, ArrowDownRight, ArrowUpRight, Menu, ArrowUp, Lock, Unlock, Monitor, Smartphone } from 'lucide-react';
import { Input, TextArea } from './components/Input';
import { Button } from './components/Button';
import { ConceptCard } from './components/ConceptCard';
import { ScanningLoader } from './components/Loader';
import { THUMBNAIL_STYLES, BRAND_FONTS, SAMPLE_BACKGROUNDS, COMMON_ASSETS } from './constants';
import { brainstormConcepts, generateThumbnailImage, analyzeImageStyle, generateLayer, isolateProductSubject } from './services/geminiService';
import { Concept, ThumbnailStyle, GeneratedImage, BrandProfile, CanvasState, BrandFont, Layer, TextLayer, ImageLayer } from './types';

// Constants for the Workspace
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

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

export default function App() {
  // Initialize with process.env check for production deployment (Vercel) support
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!process.env.API_KEY);
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ThumbnailStyle>(ThumbnailStyle.CLICKBAIT_SHOCKED);
  
  // Mobile Navigation State
  const [mobileView, setMobileView] = useState<'ideas' | 'studio' | 'edit'>('ideas');

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
    profileName: string;
  }>({
    isAnalyzing: false,
    previewUrl: null,
    detectedPrompt: '',
    profileName: ''
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
  const [activeTab, setActiveTab] = useState<'generate' | 'layers' | 'backgrounds' | 'elements'>('layers');
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
     backgroundType: 'image',
     backgroundUrl: null,
     backgroundGradient: {
        color1: '#1a1a1a',
        color2: '#000000',
        direction: 'to bottom'
     },
     layers: [
       {
        id: 'text-1',
        type: 'text',
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
        shadow: true,
        shadowColor: '#000000',
        shadowOpacity: 1,
        shadowBlur: 0,
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        visible: true,
        locked: false
       }
     ]
  });

  // Scaling State for Preview
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(0.5);
  const scaleFactorRef = useRef(0.5); // Ref for access in event handlers

  const updateScale = useCallback(() => {
    if (viewportRef.current) {
      const { clientWidth, clientHeight } = viewportRef.current;
      // We want to fit 1920x1080 into the available space with some padding
      const padding = 40;
      const availableWidth = clientWidth - padding;
      const availableHeight = clientHeight - padding;

      const scaleX = availableWidth / CANVAS_WIDTH;
      const scaleY = availableHeight / CANVAS_HEIGHT;
      
      // Use the smaller scale to ensure it fits entirely
      const newScale = Math.min(scaleX, scaleY);
      setScaleFactor(newScale);
      scaleFactorRef.current = newScale;
    }
  }, []);

  // Use ResizeObserver for robust responsiveness
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
       updateScale();
    });
    resizeObserver.observe(el);
    
    // Initial call
    updateScale();

    return () => resizeObserver.disconnect();
  }, [updateScale, activeTab, mobileView]); // Re-calculate when layout changes

  // --- INTERACTION STATE (Refactored for performance) ---
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [isIsolatingProduct, setIsIsolatingProduct] = useState(false);

  // Refs for Dragging to avoid re-renders and "hold" bugs
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

  // --- EFFECTS & INIT ---

  useEffect(() => {
    const checkKey = async () => {
      // If we have an env var (e.g. production build), trust it.
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }
      
      // Fallback: Check for AI Studio prototype environment
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
            if (selectionId) {
                deleteLayer(selectionId);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionId]);

  // --- API & ERROR HANDLING ---
  
  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.openSelectKey) {
      await aiStudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // --- HELPER UTILS ---
  
  const hexToRgba = (hex: string, alpha: number) => {
    // Ensure hex is valid
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
        detectedPrompt: 'Extracting visual style, please wait...',
        profileName: ''
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
      name: analyzingState.profileName.trim() || `Brand Style ${savedProfiles.length + 1}`,
      styleDescription: analyzingState.detectedPrompt,
      referenceImageUrl: analyzingState.previewUrl
    };
    
    setSavedProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setAnalyzingState({ isAnalyzing: false, previewUrl: null, detectedPrompt: '', profileName: '' });
  };

  const cancelBrandAnalysis = () => {
    setAnalyzingState({ isAnalyzing: false, previewUrl: null, detectedPrompt: '', profileName: '' });
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
    setMobileView('studio'); // Switch to studio view on mobile
    try {
      const productLayer = canvasState.layers.find(l => l.type === 'image' && l.isProduct) as ImageLayer;
      const productBase64 = productLayer?.sourceImage || productLayer?.url;

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

      // Reset layers but keep product if it exists
      const newLayers: Layer[] = [];
      
      // 1. Add Text Layer
      newLayers.push({
        id: crypto.randomUUID(),
        type: 'text',
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
        shadow: true,
        shadowColor: '#000000',
        shadowOpacity: 1,
        shadowBlur: 0,
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        visible: true,
        locked: false
      });

      if (productLayer) {
          newLayers.push(productLayer);
      }

      setCanvasState(prev => ({
         ...prev,
         backgroundType: 'image',
         backgroundUrl: imageUrl,
         layers: newLayers
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
              
              const newProduct: ImageLayer = {
                id: crypto.randomUUID(),
                type: 'image',
                url: transparentUrl,
                x: CANVAS_WIDTH / 2,
                y: CANVAS_HEIGHT / 2,
                scale: 1,
                rotation: 0,
                glow: false,
                glowColor: '#ffffff',
                shadow: true,
                strokeWidth: 0,
                strokeColor: '#ffffff',
                visible: true,
                locked: false,
                isProduct: true
              };

              setCanvasState(prev => ({
                 ...prev,
                 backgroundUrl: bgUrl,
                 layers: [...prev.layers, newProduct]
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
                 
                 const newLayer: ImageLayer = {
                       id: newProductId,
                       type: 'image',
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
                       strokeColor: '#ffffff',
                       visible: true,
                       locked: false,
                       isProduct: true
                 };

                 setCanvasState(prev => ({
                    ...prev,
                    layers: [...prev.layers, newLayer]
                 }));
                 setSelectionId(newProductId);
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
      const newElement: ImageLayer = {
          id: crypto.randomUUID(),
          type: 'image',
          url: url,
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          scale: 0.8,
          rotation: 0,
          glow: false,
          glowColor: '#ffffff',
          shadow: false,
          strokeWidth: 0,
          strokeColor: '#ffffff',
          visible: true,
          locked: false,
          isProduct: false
      };
      setCanvasState(prev => ({
          ...prev,
          layers: [...prev.layers, newElement]
      }));
      setSelectionId(newElement.id);
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
        setCanvasState(prev => ({ ...prev, backgroundType: 'image', backgroundUrl: url }));
     };
     reader.readAsDataURL(file);
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
      setCanvasState(prev => ({
          ...prev,
          layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } as Layer : l)
      }));
  };

  const deleteLayer = (id: string) => {
      setCanvasState(prev => ({
          ...prev,
          layers: prev.layers.filter(l => l.id !== id)
      }));
      if (selectionId === id) setSelectionId(null);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    setCanvasState(prev => {
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

  const addTextLayer = () => {
    const newText: TextLayer = {
      id: crypto.randomUUID(),
      type: 'text',
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
      shadow: true,
      shadowColor: '#000000',
      shadowOpacity: 0.8,
      shadowBlur: 0,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      visible: true,
      locked: false
    };
    setCanvasState(prev => ({
      ...prev,
      layers: [...prev.layers, newText]
    }));
    setSelectionId(newText.id);
    setActiveTab('layers');
  };

  const duplicateLayer = (layer: Layer) => {
    const newLayer = {
        ...layer,
        id: crypto.randomUUID(),
        x: layer.x + 40,
        y: layer.y + 40,
    };
    setCanvasState(prev => ({
        ...prev,
        layers: [...prev.layers, newLayer]
    }));
    setSelectionId(newLayer.id);
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

  // --- CANVAS INTERACTION CORE (REFACTORED FOR RESPONSIVENESS & PERF) ---

  // Global Mouse Move Listener (Attached only during drag)
  const handleMouseMoveGlobal = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag.isDragging || !drag.targetId) return;

    // Calculate raw delta from start of drag
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    // Apply scale factor to delta to ensure 1:1 movement on canvas
    const scale = scaleFactorRef.current;
    const adjustedDeltaX = deltaX / scale;
    const adjustedDeltaY = deltaY / scale;

    // Update state directly
    setCanvasState(prev => ({
        ...prev,
        layers: prev.layers.map(l => l.id === drag.targetId ? {
            ...l,
            x: drag.initialLayerX + adjustedDeltaX,
            y: drag.initialLayerY + adjustedDeltaY
        } : l)
    }));
  }, []);

  // Global Mouse Up Listener
  const handleMouseUpGlobal = useCallback(() => {
    dragRef.current.isDragging = false;
    dragRef.current.targetId = null;
    
    // Clean up listeners
    window.removeEventListener('mousemove', handleMouseMoveGlobal);
    window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, [handleMouseMoveGlobal]);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); 
      e.preventDefault();
      
      const layer = canvasState.layers.find(l => l.id === id);
      if (!layer || layer.locked) return;

      setSelectionId(id);
      setActiveTab('layers');
      setMobileView('edit'); 

      // Initialize Drag State in Ref
      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        initialLayerX: layer.x,
        initialLayerY: layer.y,
        targetId: id
      };

      // Attach global listeners only when needed
      window.addEventListener('mousemove', handleMouseMoveGlobal);
      window.addEventListener('mouseup', handleMouseUpGlobal);
  };

  const handleBackgroundClick = () => {
      setSelectionId(null);
  };

  // --- RENDER HELPERS ---

  const renderLayerControls = () => {
    if (!selectionId) return (
        <div className="text-center text-gray-500 text-sm p-8 bg-dark-800/30 rounded-lg border border-dashed border-dark-700">
            Click an item to edit properties
        </div>
    );

    const layer = canvasState.layers.find(l => l.id === selectionId);
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
            updateLayer(imgLayer.id, { x: newX, y: newY });
        };

        return (
          <div className="bg-dark-900 border border-dark-800 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
               <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-brand-400 uppercase flex items-center">
                    {imgLayer.isProduct ? <Box className="w-3 h-3 mr-2"/> : <Sticker className="w-3 h-3 mr-2"/>}
                    {imgLayer.isProduct ? 'Product Layer' : 'Element Layer'}
                  </h3>
                  <div className="flex gap-1">
                     <button onClick={() => duplicateLayer(imgLayer)} className="p-1 hover:bg-dark-700 rounded"><Copy className="w-4 h-4 text-gray-400"/></button>
                     <button onClick={() => deleteLayer(imgLayer.id)} className="p-1 hover:bg-red-900/30 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
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
                      <input type="range" min="0.1" max="3" step="0.1" value={imgLayer.scale} onChange={(e) => updateLayer(imgLayer.id, { scale: parseFloat(e.target.value) })} className="w-full accent-brand-500" />
                  </div>
                  <div className="space-y-1">
                      <span className="text-xs text-gray-400">Rotation</span>
                      <input type="range" min="-180" max="180" step="1" value={imgLayer.rotation} onChange={(e) => updateLayer(imgLayer.id, { rotation: parseInt(e.target.value) })} className="w-full accent-brand-500" />
                  </div>
               </div>
    
               <div className="pt-2 border-t border-dark-800 space-y-3">
                   <label className="flex items-center text-xs text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={imgLayer.shadow} onChange={(e) => updateLayer(imgLayer.id, { shadow: e.target.checked })} className="mr-2 rounded bg-dark-700 border-dark-600 text-brand-600 focus:ring-0" />
                      Drop Shadow
                   </label>
                   <div className="flex items-center gap-2">
                       <label className="flex items-center text-xs text-gray-300 cursor-pointer flex-1">
                          <input type="checkbox" checked={imgLayer.glow} onChange={(e) => updateLayer(imgLayer.id, { glow: e.target.checked })} className="mr-2 rounded bg-dark-700 border-dark-600 text-brand-600 focus:ring-0" />
                          Outer Glow
                       </label>
                       <input type="color" value={imgLayer.glowColor || '#ffffff'} onChange={(e) => updateLayer(imgLayer.id, { glowColor: e.target.value })} disabled={!imgLayer.glow} className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer disabled:opacity-50" />
                   </div>
                </div>
            </div>
        );
    } else {
        const text = layer as TextLayer;
        return (
            <div className="bg-dark-900 border border-dark-800 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-brand-400 uppercase flex items-center"><TypeIcon className="w-3 h-3 mr-2"/>Text Layer</h3>
                <div className="flex gap-1">
                    <button onClick={() => duplicateLayer(text)} className="p-1 hover:bg-dark-700 rounded"><Copy className="w-4 h-4 text-gray-400"/></button>
                    <button onClick={() => deleteLayer(text.id)} className="p-1 hover:bg-red-900/30 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
                </div>
              </div>
              
              <TextArea value={text.text} onChange={e => updateLayer(text.id, { text: e.target.value })} className="text-lg font-bold" />
      
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <span className="text-xs text-gray-400">Font</span>
                      <select value={text.font} onChange={e => updateLayer(text.id, { font: e.target.value as BrandFont })} className="w-full bg-dark-800 border border-dark-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 outline-none">
                          {BRAND_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1">
                      <span className="text-xs text-gray-400">Color</span>
                      <input type="color" value={text.color} onChange={e => updateLayer(text.id, { color: e.target.value })} className="w-full h-9 p-0 bg-transparent border-none rounded cursor-pointer" />
                  </div>
              </div>
      
              <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <span className="text-xs text-gray-400">Font Size ({text.fontSize}px)</span>
                        <input type="range" min="20" max="600" step="5" value={text.fontSize} onChange={e => updateLayer(text.id, { fontSize: parseInt(e.target.value) })} className="w-full accent-brand-500" />
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs text-gray-400">Rotation ({text.rotation}°)</span>
                        <input type="range" min="-45" max="45" step="1" value={text.rotation} onChange={e => updateLayer(text.id, { rotation: parseInt(e.target.value) })} className="w-full accent-brand-500" />
                    </div>
              </div>
              
              {/* Stroke Section */}
              <div className="pt-2 border-t border-dark-800 space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-gray-500">Stroke / Outline</h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <span className="text-xs text-gray-400">Width</span>
                          <input type="range" min="0" max="40" step="1" value={text.strokeWidth} onChange={e => updateLayer(text.id, { strokeWidth: parseInt(e.target.value) })} className="w-full accent-brand-500" />
                      </div>
                      <div className="space-y-1">
                          <span className="text-xs text-gray-400">Color</span>
                          <input type="color" value={text.strokeColor} onChange={e => updateLayer(text.id, { strokeColor: e.target.value })} className="w-full h-9 p-0 bg-transparent border-none rounded cursor-pointer" />
                      </div>
                  </div>
              </div>

              {/* Shadow Section */}
              <div className="pt-2 border-t border-dark-800 space-y-3">
                  <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase font-bold text-gray-500">Drop Shadow</h4>
                      <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={!!text.shadow} onChange={e => updateLayer(text.id, { shadow: e.target.checked })} className="sr-only peer"/>
                          <div className="w-7 h-4 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-600"></div>
                      </label>
                  </div>
                  
                  {text.shadow && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-12">Color</span>
                           <input type="color" value={text.shadowColor} onChange={e => updateLayer(text.id, { shadowColor: e.target.value })} className="flex-1 h-6 p-0 bg-transparent border-none rounded cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-12">Opacity</span>
                           <input type="range" min="0" max="1" step="0.05" value={text.shadowOpacity ?? 1} onChange={e => updateLayer(text.id, { shadowOpacity: parseFloat(e.target.value) })} className="flex-1 accent-brand-500" />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-12">Blur</span>
                           <input type="range" min="0" max="50" value={text.shadowBlur} onChange={e => updateLayer(text.id, { shadowBlur: parseInt(e.target.value) })} className="flex-1 accent-brand-500" />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-12">X Off</span>
                           <input type="range" min="-50" max="50" value={text.shadowOffsetX} onChange={e => updateLayer(text.id, { shadowOffsetX: parseInt(e.target.value) })} className="flex-1 accent-brand-500" />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 w-12">Y Off</span>
                           <input type="range" min="-50" max="50" value={text.shadowOffsetY} onChange={e => updateLayer(text.id, { shadowOffsetY: parseInt(e.target.value) })} className="flex-1 accent-brand-500" />
                        </div>
                    </div>
                  )}
              </div>
            </div>
          );
    }
  };

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

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col md:flex-row font-sans antialiased text-gray-200 overflow-hidden select-none">
      
      {/* --- LEFT PANEL: Generation --- */}
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
          <div className="space-y-3 pb-6 border-b border-dark-800">
              <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center"><Fingerprint className="w-4 h-4 mr-2"/>Brand Identity</h2>
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
                    <Input label="Style Name" placeholder="e.g. Tech Minimalist" value={analyzingState.profileName} onChange={(e) => setAnalyzingState(prev => ({...prev, profileName: e.target.value}))} className="bg-dark-900/50 border-brand-500/30 focus:border-brand-500" />
                    <TextArea label="Detected Style Prompt" value={analyzingState.detectedPrompt} onChange={(e) => setAnalyzingState(prev => ({...prev, detectedPrompt: e.target.value}))} className="text-xs font-mono h-24 bg-dark-900/50" placeholder="AI is analyzing..." />
                    <Button size="sm" className="w-full" onClick={saveBrandProfile} disabled={analyzingState.isAnalyzing} icon={<Check className="w-3 h-3"/>}>Save as New Profile</Button>
                </div>
              ) : (
                <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 space-y-3">
                  <select value={activeProfileId || ''} onChange={(e) => setActiveProfileId(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none">
                      <option value="">Default / No Style</option>
                      {savedProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} icon={<Upload className="w-3 h-3"/>}>Analyze New Style</Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*"/>
                </div>
              )}
          </div>
          
          {/* Generation Form */}
          <div className="space-y-3">
              <h2 className="text-xs uppercase font-bold text-gray-500 tracking-wider flex items-center"><Youtube className="w-4 h-4 mr-2"/>Video Details</h2>
              <Input label="Video Topic or Title" placeholder="e.g., 'Slingmods 2025 Product Reveal'" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Thumbnail Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {THUMBNAIL_STYLES.map(style => (
                      <button key={style.value} onClick={() => setSelectedStyle(style.value)} className={`p-2 rounded-lg text-left text-xs transition-all border ${selectedStyle === style.value ? 'bg-brand-600/20 border-brand-500 text-white' : 'bg-dark-800 border-dark-700 hover:border-dark-600 text-gray-400'}`}>
                        <span className="mr-2">{style.icon}</span>{style.label.split(' ')[1]}
                      </button>
                    ))}
                  </div>
              </div>
              <Button onClick={handleBrainstorm} isLoading={isBrainstorming} className="w-full h-12 text-lg" size="md" icon={<Sparkles className="w-5 h-5"/>}>Brainstorm Concepts</Button>
          </div>
          
          {/* Concepts */}
          <div className="space-y-3 pb-10">
              {isBrainstorming && <ScanningLoader text="Generating viral ideas..." />}
              {concepts.map(c => (
                  <ConceptCard key={c.id} concept={c} onGenerate={handleGenerateImage} onUpdate={(id, updates) => setConcepts(prev => prev.map(p => p.id === id ? {...p, ...updates} : p))} isGenerating={isGenerating} />
              ))}
          </div>
        </div>
      </aside>

      {/* --- CENTER PANEL: Workspace --- */}
      <main className={`${mobileView === 'studio' ? 'flex' : 'hidden'} md:flex flex-1 bg-dark-950 flex-col relative overflow-hidden h-[calc(100vh-60px)] md:h-screen`}>
        
        {/* Top Bar */}
        <div className="h-14 border-b border-dark-800 bg-dark-900 flex items-center justify-between px-4 shrink-0 z-20">
           <div className="flex items-center space-x-4 text-gray-400 text-sm hidden md:flex">
               <span>{CANVAS_WIDTH} x {CANVAS_HEIGHT}</span>
               <span className="text-dark-700">|</span>
               <span>{Math.round(scaleFactor * 100)}% Zoom</span>
           </div>
           <div className="flex gap-2 ml-auto md:ml-0">
             {generatedImage && (
                <Button variant="secondary" size="sm" onClick={handleSplitLayers} isLoading={isSplitting} icon={<Scissors className="w-4 h-4"/>}>Split Layers</Button>
             )}
             <Button onClick={handleExport} size="sm" icon={<Download className="w-4 h-4"/>}>Export</Button>
           </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden p-4 md:p-8" ref={viewportRef} onClick={handleBackgroundClick}>
            <div style={{
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
                <div className="absolute inset-0 z-0 pointer-events-none select-none"
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
                                    zIndex: 1, // Z-index handled by array order mostly
                                    cursor: 'move'
                                }}
                                onMouseDown={(e) => handleMouseDown(e, imgLayer.id)}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="relative group" style={{ transform: 'translate(-50%, -50%)' }}>
                                    {/* Selection Box */}
                                    {isSelected && (
                                        <div className="absolute -inset-2 border-2 border-brand-500 rounded-sm pointer-events-none z-50">
                                            {/* Corner Handles (Visual Only for now) */}
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
                                     {/* Selection Box */}
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
      </main>

      {/* --- RIGHT PANEL: Properties & Assets --- */}
      <aside className={`${mobileView === 'edit' ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] bg-dark-900 flex-col border-l border-dark-800 h-[calc(100vh-60px)] md:h-screen z-10 shadow-2xl`}>
          <div className="flex p-2 bg-dark-950 border-b border-dark-800 shrink-0 gap-1">
             <button onClick={() => setActiveTab('layers')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'layers' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><Layers className="w-4 h-4 mr-2"/>Layers</button>
             <button onClick={() => setActiveTab('elements')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'elements' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><Sticker className="w-4 h-4 mr-2"/>Elements</button>
             <button onClick={() => setActiveTab('backgrounds')} className={`flex-1 py-2 text-xs font-medium rounded-md flex items-center justify-center transition-colors ${activeTab === 'backgrounds' ? 'bg-dark-800 text-white shadow-sm border border-dark-700' : 'text-gray-500 hover:text-gray-300'}`}><ImageIcon className="w-4 h-4 mr-2"/>BGs</button>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar bg-dark-900/50">
              {activeTab === 'layers' && (
                <div className="space-y-6">
                  {/* Unified Layer List (Photoshop Style) */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center">Layer Stack (Top = Front)</h3>
                    <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
                        {/* Reverse map so top layer is at top of list visually */}
                        {[...canvasState.layers].reverse().map((layer, revIndex) => {
                           const realIndex = canvasState.layers.length - 1 - revIndex;
                           return (
                               <div key={layer.id} className={`p-3 flex items-center gap-3 border-b border-dark-700 last:border-0 ${selectionId === layer.id ? 'bg-brand-900/20' : 'hover:bg-dark-700/50'} transition-colors cursor-pointer`}
                                    onClick={() => { setSelectionId(layer.id); setMobileView('edit'); }}
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
                  {renderLayerControls()}

                  {/* Add Actions */}
                  <div className="pt-4 border-t border-dark-800 space-y-3">
                    <div className="p-4 bg-dark-800 rounded-lg border border-dark-700 group hover:border-brand-500 transition-colors">
                        <Button className="w-full" variant="secondary" size="sm" icon={<Box className="w-4 h-4" />} onClick={() => productInputRef.current?.click()} isLoading={isIsolatingProduct}>
                            {isIsolatingProduct ? 'Isolating Subject...' : 'Add Product / Subject'}
                        </Button>
                        <input type="file" ref={productInputRef} onChange={handleProductUpload} className="hidden" accept="image/*" />
                        <p className="text-[10px] text-gray-500 mt-2 text-center">Supports auto-background removal</p>
                    </div>
                    <Button className="w-full" variant="ghost" size="sm" onClick={addTextLayer} icon={<TypeIcon className="w-4 h-4"/>}>Add New Text Layer</Button>
                  </div>
                </div>
              )}
              
              {activeTab === 'backgrounds' && (
                <div className="space-y-6">
                    <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 space-y-4">
                        <h3 className="text-[10px] uppercase font-bold text-gray-500">Gradient Base</h3>
                        <div className="flex gap-2">
                            <input type="color" value={canvasState.backgroundGradient.color1} onChange={(e) => setCanvasState(prev => ({ ...prev, backgroundType: 'gradient', backgroundGradient: { ...prev.backgroundGradient, color1: e.target.value } }))} className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer" />
                            <input type="color" value={canvasState.backgroundGradient.color2} onChange={(e) => setCanvasState(prev => ({ ...prev, backgroundType: 'gradient', backgroundGradient: { ...prev.backgroundGradient, color2: e.target.value } }))} className="w-8 h-8 p-0 bg-transparent border-none rounded cursor-pointer" />
                        </div>
                        
                        <h4 className="text-[10px] uppercase font-bold text-gray-500 pt-2 border-t border-dark-700">Presets</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {GRADIENT_PRESETS.map((p) => (
                                <button 
                                    key={p.name}
                                    onClick={() => setCanvasState(prev => ({
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
                            <div key={bg} className="relative aspect-video rounded-md overflow-hidden cursor-pointer group border border-dark-700 hover:border-brand-500" onClick={() => setCanvasState(prev => ({...prev, backgroundType: 'image', backgroundUrl: bg}))}>
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

      {/* --- MOBILE NAVIGATION --- */}
      <nav className="md:hidden fixed bottom-0 w-full bg-dark-900 border-t border-dark-800 flex justify-around z-50 h-[60px]">
         <button 
           onClick={() => setMobileView('ideas')} 
           className={`flex flex-col items-center justify-center w-full ${mobileView === 'ideas' ? 'text-brand-500' : 'text-gray-500'}`}
         >
            <Sparkles className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Ideas</span>
         </button>
         <button 
           onClick={() => setMobileView('studio')} 
           className={`flex flex-col items-center justify-center w-full ${mobileView === 'studio' ? 'text-brand-500' : 'text-gray-500'}`}
         >
            <Monitor className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Studio</span>
         </button>
         <button 
           onClick={() => setMobileView('edit')} 
           className={`flex flex-col items-center justify-center w-full ${mobileView === 'edit' ? 'text-brand-500' : 'text-gray-500'}`}
         >
            <Layers className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Layers</span>
         </button>
      </nav>
    </div>
  );
}
