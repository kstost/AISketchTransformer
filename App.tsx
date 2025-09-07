import React, { useState, useRef, useCallback, useEffect } from 'react';
import Canvas, { CanvasHandles } from './components/Canvas';
import ImageEditor, { ImageEditorHandles } from './components/ImageEditor';
import { transformSketch, editImage, USE_USER_PROVIDED_API_KEY } from './services/geminiService';

const STYLE_OPTIONS = ["Photorealistic", "Illustration", "Cartoon", "Custom"];
const CUSTOM_STYLE_KEY = "Custom";
const API_KEY_STORAGE_KEY = 'gemini-api-key';

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10.868 2.884c.321.64.321 1.393 0 2.034l-1.33 2.661a1.006 1.006 0 01-1.076.655c-.64-.107-1.076-.754-1.076-1.393L8.614 4.18c-.107-.64.321-1.286.963-1.393.642-.107 1.286.321 1.393.963zM10 5.152l.244.489.547 1.095c.107.213.321.32.535.32h1.198c.642 0 1.07.754.754 1.286l-.963 1.605a1.006 1.006 0 01-.858.535l-2.034.321c-.642.107-.963-.535-.642-1.076l1.393-2.321c.213-.321.107-.754-.107-.963L10 5.152zM4.18 8.614c-.64.107-1.286-.321-1.393-.963s.321-1.286.963-1.393l2.661-1.33c.64-.321 1.393 0 2.034 0l2.661 1.33c.642.107.963.754.963 1.393s-.321 1.286-.963 1.393l-2.661.444c-.64.107-1.393-.321-2.034-.321L4.18 8.614zM15.82 11.386c.64-.107 1.286.321 1.393.963s-.321 1.286-.963 1.393l-2.661 1.33c-.64.321-1.393 0-2.034 0l-2.661-1.33c-.642-.107-.963-.754-.963-1.393s.321-1.286.963-1.393l2.661-.444c.64-.107 1.393.321 2.034.321l2.141-.357z" clipRule="evenodd" />
  </svg>
);

const UndoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
);

const RedoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
  </svg>
);

const PaintBrushIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.608 3.422a2.33 2.33 0 013.295 0 2.33 2.33 0 010 3.295L8.52 20.099a4.25 4.25 0 01-6.009-6.01l16.097-10.667zM7.058 15.488a1.75 1.75 0 10-2.474-2.474 1.75 1.75 0 002.474 2.474z" />
    </svg>
);

const EraserIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.78 4.22a2.33 2.33 0 00-3.295 0l-7.92 7.92a.5.5 0 000 .707l3.96 3.96a.5.5 0 00.707 0l7.92-7.92a2.33 2.33 0 000-3.295L19.78 4.22zM4 19.5a1.5 1.5 0 001.5 1.5H18v-3H5.5A1.5 1.5 0 004 16.5v3z" />
    </svg>
);

const ApiKeyErrorModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md text-center">
                <h3 className="text-2xl font-bold text-red-400 mb-4">Invalid API Key</h3>
                <p className="text-gray-300 mb-6">
                    The provided Gemini API Key is incorrect. It has been cleared from storage. Please enter a valid key.
                </p>
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

const ErrorModal = ({ isOpen, onClose, message }: { isOpen: boolean; onClose: () => void; message: string | null; }) => {
    if (!isOpen || !message) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md text-center">
                <h3 className="text-2xl font-bold text-yellow-400 mb-4">Warning</h3>
                <p className="text-gray-300 mb-6">
                    {message}
                </p>
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                    Close
                </button>
            </div>
        </div>
    );
};


function App() {
  const [selectedStyle, setSelectedStyle] = useState<string>(STYLE_OPTIONS[0]);
  const [customStyle, setCustomStyle] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editorMode, setEditorMode] = useState<'draw' | 'erase'>('erase');
  const [error, setError] = useState<string | null>(null);
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canEditorUndo, setCanEditorUndo] = useState(false);
  const [canEditorRedo, setCanEditorRedo] = useState(false);

  const [inpaintingPrompt, setInpaintingPrompt] = useState('');

  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [imageHistoryPointer, setImageHistoryPointer] = useState(-1);

  const [userApiKey, setUserApiKey] = useState<string>('');
  const [isInvalidKeyModalOpen, setIsInvalidKeyModalOpen] = useState(false);

  const canvasRef = useRef<CanvasHandles>(null);
  const imageEditorRef = useRef<ImageEditorHandles>(null);
  
  useEffect(() => {
    if (USE_USER_PROVIDED_API_KEY) {
      const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedApiKey) {
        setUserApiKey(storedApiKey);
      }
    }
  }, []);

  const handleApiKeyChange = (key: string) => {
      setUserApiKey(key);
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
  };

  const handleApiError = (e: unknown) => {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    if (errorMessage.includes('API Key is invalid') || errorMessage.includes('API key not valid')) {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        setUserApiKey('');
        setIsInvalidKeyModalOpen(true);
    } else {
        setError(errorMessage);
    }
  };

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);
  
  const handleEditorHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanEditorUndo(undo);
    setCanEditorRedo(redo);
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (generatedImage) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image')) {
          const file = items[i].getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (e: ProgressEvent<FileReader>) => {
            if (e.target?.result && typeof e.target.result === 'string') {
              canvasRef.current?.drawImageFromUrl(e.target.result);
            }
          };
          reader.readAsDataURL(file);
          
          event.preventDefault();
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [generatedImage]);

  const handleGenerateClick = async () => {
    if (canvasRef.current?.isEmpty()) {
      setError('Please draw a sketch before generating an image.');
      return;
    }
    const imageDataUrl = canvasRef.current?.getImageDataUrl();
    if (!imageDataUrl) {
      setError('Could not get sketch data.');
      return;
    }

    const stylePrompt = selectedStyle === CUSTOM_STYLE_KEY ? customStyle : selectedStyle;
    if (!stylePrompt) {
      setError('Please select or enter an image style.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    setImageHistory([]);
    setImageHistoryPointer(-1);

    try {
      const resultImageUrl = await transformSketch(imageDataUrl, stylePrompt, userApiKey);
      setGeneratedImage(resultImageUrl);
      setImageHistory([resultImageUrl]);
      setImageHistoryPointer(0);
      setEditorMode('erase');
    } catch (e) {
      handleApiError(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditClick = async () => {
    if (!imageEditorRef.current) {
        setError('Image editor is not available.');
        return;
    }

    const editedImageDataUrl = imageEditorRef.current.getEditedImageDataUrl();
    if (!editedImageDataUrl) {
        setError('Could not get edited image data.');
        return;
    }

    setIsEditing(true);
    setError(null);

    try {
        const resultImageUrl = await editImage(editedImageDataUrl, inpaintingPrompt, userApiKey);
        const newHistory = imageHistory.slice(0, imageHistoryPointer + 1);
        newHistory.push(resultImageUrl);
        
        setGeneratedImage(resultImageUrl);
        setImageHistory(newHistory);
        setImageHistoryPointer(newHistory.length - 1);
        setInpaintingPrompt('');
    } catch (e) {
      handleApiError(e);
    } finally {
        setIsEditing(false);
    }
  };

  const handleEditorUndo = () => {
    if (canEditorUndo) {
        imageEditorRef.current?.undo();
        return;
    }
    if (imageHistoryPointer > 0) {
        const newPointer = imageHistoryPointer - 1;
        setImageHistoryPointer(newPointer);
        setGeneratedImage(imageHistory[newPointer]);
    }
  };

  const handleEditorRedo = () => {
      if (canEditorRedo) {
          imageEditorRef.current?.redo();
          return;
      }
      if (imageHistoryPointer < imageHistory.length - 1) {
          const newPointer = imageHistoryPointer + 1;
          setImageHistoryPointer(newPointer);
          setGeneratedImage(imageHistory[newPointer]);
      }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-8">
      <ApiKeyErrorModal isOpen={isInvalidKeyModalOpen} onClose={() => setIsInvalidKeyModalOpen(false)} />
      <ErrorModal isOpen={error !== null} onClose={() => setError(null)} message={error} />
      <header className="w-full max-w-6xl text-center mb-6 md:mb-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          AI Sketch Transformer
        </h1>
        <p className="text-gray-400 mt-2 text-md sm:text-lg">
          Transform your simple sketches into stunning images.
        </p>
      </header>

      {USE_USER_PROVIDED_API_KEY && (
        <section className="w-full max-w-6xl mb-8">
            <div className="p-6 bg-gray-800 rounded-xl shadow-2xl text-left">
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                    Gemini API Key
                </label>
                <input
                    id="apiKey"
                    type="password"
                    value={userApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-2">
                    Don't have an API key?{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                        Get one from Google AI Studio.
                    </a>
                </p>
            </div>
        </section>
      )}

      <main className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6 p-6 bg-gray-800 rounded-xl shadow-2xl">
          <div className="aspect-square w-full">
            <Canvas ref={canvasRef} onHistoryChange={handleHistoryChange} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <button
                onClick={() => canvasRef.current?.undo()}
                disabled={!canUndo}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Undo"
            >
                <UndoIcon className="w-6 h-6" />
            </button>
            <button
                onClick={() => canvasRef.current?.redo()}
                disabled={!canRedo}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Redo"
            >
                <RedoIcon className="w-6 h-6" />
            </button>
            <button
              onClick={() => canvasRef.current?.clearCanvas()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              Clear
            </button>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-300">Select a Style</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    selectedStyle === style
                      ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            {selectedStyle === CUSTOM_STYLE_KEY && (
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g., 'A watercolor landscape'"
                className="w-full mt-3 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            )}
          </div>
          <button
            onClick={handleGenerateClick}
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg shadow-lg disabled:opacity-70 disabled:cursor-wait transition-all duration-300 transform hover:scale-105"
          >
            <SparklesIcon className="w-5 h-5"/>
            {isLoading ? 'Generating...' : 'Generate Image'}
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6 bg-gray-800 rounded-xl shadow-2xl">
          <div className="aspect-square w-full flex items-center justify-center bg-gray-900/50 rounded-lg">
            {isLoading && (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-600 rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-400">The AI is painting...</p>
              </div>
            )}
            {!isLoading && !error && generatedImage && (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <ImageEditor ref={imageEditorRef} imageUrl={generatedImage} onHistoryChange={handleEditorHistoryChange} mode={editorMode} />
                {isEditing && (
                    <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center rounded-lg transition-opacity duration-300">
                        <div className="w-12 h-12 border-4 border-t-teal-500 border-gray-600 rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-300">Applying edits...</p>
                    </div>
                )}
              </div>
            )}
            {!isLoading && !error && !generatedImage && (
              <p className="text-gray-500">Your generated image will appear here.</p>
            )}
          </div>
          
          {generatedImage && !isLoading && (
            <div className='flex flex-col gap-3'>
                <h3 className="text-lg font-semibold text-gray-300">Edit Image</h3>
                <p className="text-sm text-gray-400">
                    Use Erase or Draw mode, then describe the changes below (optional).
                </p>
                 <div className="flex justify-center items-center gap-2">
                    <button
                        onClick={handleEditorUndo}
                        disabled={(!canEditorUndo && imageHistoryPointer <= 0) || isEditing}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Undo Edit"
                    >
                        <UndoIcon className="w-6 h-6" />
                    </button>
                    <button
                        onClick={handleEditorRedo}
                        disabled={(!canEditorRedo && imageHistoryPointer >= imageHistory.length - 1) || isEditing}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Redo Edit"
                    >
                        <RedoIcon className="w-6 h-6" />
                    </button>
                    <div className="w-px h-6 bg-gray-600 mx-2"></div>
                    <button
                      onClick={() => setEditorMode('draw')}
                      className={`p-2 rounded-full transition-colors ${editorMode === 'draw' ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                      aria-label="Draw mode"
                      disabled={isEditing}
                    >
                      <PaintBrushIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setEditorMode('erase')}
                      className={`p-2 rounded-full transition-colors ${editorMode === 'erase' ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                      aria-label="Erase mode"
                      disabled={isEditing}
                    >
                      <EraserIcon className="w-6 h-6" />
                    </button>
                </div>
                <input
                    type="text"
                    value={inpaintingPrompt}
                    onChange={(e) => setInpaintingPrompt(e.target.value)}
                    placeholder="e.g., 'Make the dog's ears pointy'"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    disabled={isEditing}
                />
                <button
                    onClick={handleEditClick}
                    disabled={isEditing}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold rounded-lg shadow-lg disabled:opacity-70 disabled:cursor-wait transition-all duration-300 transform hover:scale-105"
                >
                    {isEditing ? 'Applying...' : 'Apply Edits'}
                </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;