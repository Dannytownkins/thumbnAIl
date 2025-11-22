import React, { useState, useEffect, useRef } from 'react';
import { Key, Download, Scissors, Sparkles, Monitor, Layers } from 'lucide-react';
import { Button } from './components/Button';
import { GenerationPanel } from './components/GenerationPanel';
import { Canvas } from './components/Canvas';
import { RightPanel } from './components/RightPanel';
import { SAMPLE_BACKGROUNDS } from './constants';
import { brainstormConcepts, generateThumbnailImage, analyzeImageStyle, generateLayer, isolateProductSubject } from './services/geminiService';
import { Concept, ThumbnailStyle, GeneratedImage, BrandProfile, CanvasState, BrandFont, Layer, ImageLayer } from './types';
import { exportCanvas } from './utils/canvas';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!process.env.API_KEY);
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ThumbnailStyle>(ThumbnailStyle.CLICKBAIT_SHOCKED);
  const [mobileView, setMobileView] = useState<'ideas' | 'studio' | 'edit'>('ideas');

  // Brand Profiles State
  const [savedProfiles, setSavedProfiles] = useState<BrandProfile[]>(() => {
    try {
      const saved = localStorage.getItem('thumbnail_profiles');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

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

  // Canvas State
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

  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [isIsolatingProduct, setIsIsolatingProduct] = useState(false);

  // API Key Check
  useEffect(() => {
    const checkKey = async () => {
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }

      const aiStudio = (window as any).aistudio;
      if (aiStudio && aiStudio.hasSelectedApiKey) {
        const hasKey = await aiStudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        if (selectionId) {
          setCanvasState(prev => ({
            ...prev,
            layers: prev.layers.filter(l => l.id !== selectionId)
          }));
          setSelectionId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionId]);

  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.openSelectKey) {
      await aiStudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // Brand Profile Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;

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

  // Generation Handlers
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
    setMobileView('studio');
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

      const newLayers: Layer[] = [];

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

  const addTextLayer = () => {
    const newText = {
      id: crypto.randomUUID(),
      type: 'text' as const,
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

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setCanvasState(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } as Layer : l)
    }));
  };

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
      <GenerationPanel
        mobileView={mobileView}
        topic={topic}
        onTopicChange={setTopic}
        selectedStyle={selectedStyle}
        onStyleChange={setSelectedStyle}
        savedProfiles={savedProfiles}
        activeProfileId={activeProfileId}
        onActiveProfileChange={setActiveProfileId}
        analyzingState={analyzingState}
        onAnalyzingStateChange={setAnalyzingState}
        onFileUpload={handleFileUpload}
        onSaveProfile={saveBrandProfile}
        onCancelAnalysis={cancelBrandAnalysis}
        isBrainstorming={isBrainstorming}
        onBrainstorm={handleBrainstorm}
        concepts={concepts}
        onConceptUpdate={(id, updates) => setConcepts(prev => prev.map(p => p.id === id ? {...p, ...updates} : p))}
        onGenerateImage={handleGenerateImage}
        isGenerating={isGenerating}
      />

      <main className={`${mobileView === 'studio' ? 'flex' : 'hidden'} md:flex flex-1 bg-dark-950 flex-col relative overflow-hidden h-[calc(100vh-60px)] md:h-screen`}>
        <div className="h-14 border-b border-dark-800 bg-dark-900 flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center space-x-4 text-gray-400 text-sm hidden md:flex">
            <span>{CANVAS_WIDTH} x {CANVAS_HEIGHT}</span>
            <span className="text-dark-700">|</span>
            <span>Canvas</span>
          </div>
          <div className="flex gap-2 ml-auto md:ml-0">
            {generatedImage && (
              <Button variant="secondary" size="sm" onClick={handleSplitLayers} isLoading={isSplitting} icon={<Scissors className="w-4 h-4"/>}>Split Layers</Button>
            )}
            <Button onClick={() => exportCanvas(canvasState)} size="sm" icon={<Download className="w-4 h-4"/>}>Export</Button>
          </div>
        </div>

        <Canvas
          canvasState={canvasState}
          selectionId={selectionId}
          onSelectionChange={setSelectionId}
          onLayerUpdate={updateLayer}
          onTabChange={setActiveTab}
          onMobileViewChange={setMobileView}
        />
      </main>

      <RightPanel
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canvasState={canvasState}
        onCanvasStateChange={setCanvasState}
        selectionId={selectionId}
        onSelectionChange={setSelectionId}
        onMobileViewChange={setMobileView}
        backgroundLibrary={backgroundLibrary}
        onBackgroundLibraryChange={setBackgroundLibrary}
        isIsolatingProduct={isIsolatingProduct}
        onProductUpload={handleProductUpload}
        onAddTextLayer={addTextLayer}
        onAddElement={addElement}
        mobileView={mobileView}
      />

      {/* Mobile Navigation */}
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
