import React, { useState, useRef, useCallback, useEffect } from 'react';
import Canvas, { CanvasHandles } from './components/Canvas';
import ImageEditor, { ImageEditorHandles } from './components/ImageEditor';
import { transformSketch, editImage } from './services/geminiService';

// Set to true to show the API key input field. When false, the app will use
// the API key from the environment variable (process.env.API_KEY).
const SHOW_API_KEY_INPUT = !false;

const STYLE_OPTIONS = ["Photorealistic", "Illustration", "Cartoon", "Custom"];
const CUSTOM_STYLE_KEY = "Custom";

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

const ClipboardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.042m-7.416 0v3.042c0 .212.03.418.084.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
);

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function App() {
  const [apiKey, setApiKey] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>(STYLE_OPTIONS[0]);
  const [customStyle, setCustomStyle] = useState('');
  const [customStyleImage, setCustomStyleImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canEditorUndo, setCanEditorUndo] = useState(false);
  const [canEditorRedo, setCanEditorRedo] = useState(false);

  const [inpaintingPrompt, setInpaintingPrompt] = useState('');

  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [imageHistoryPointer, setImageHistoryPointer] = useState(-1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Error');
  const [modalMessage, setModalMessage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const canvasRef = useRef<CanvasHandles>(null);
  const imageEditorRef = useRef<ImageEditorHandles>(null);
  
  useEffect(() => {
    if (SHOW_API_KEY_INPUT) {
      const storedApiKey = localStorage.getItem('geminiApiKey');
      if (storedApiKey) {
          setApiKey(storedApiKey);
      }
    } else {
      setApiKey(process.env.API_KEY || '');
    }
  }, []);
  
  const showErrorModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setIsModalOpen(true);
  };
  
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('geminiApiKey', newKey);
  }

  const handleApiError = (e: unknown) => {
    let errorMessage = 'An unknown error occurred.';
    let errorTitle = 'Generation Failed';

    if (e instanceof Error) {
      errorMessage = e.message;
      if (e.message === 'Invalid API Key') {
        errorTitle = 'API Key Error';
        errorMessage = 'Your Gemini API Key is invalid. Please check it and try again.';
        if (SHOW_API_KEY_INPUT) {
          errorMessage += ' The incorrect key has been cleared.';
          setApiKey('');
          localStorage.removeItem('geminiApiKey');
        }
      }
    }
    showErrorModal(errorTitle, errorMessage);
  };

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);
  
  const handleEditorHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanEditorUndo(undo);
    setCanEditorRedo(redo);
  }, []);

  const handleGenerateClick = async () => {
    if (!apiKey) {
      showErrorModal('API Key Missing', SHOW_API_KEY_INPUT ? 'Please enter your Gemini API Key above.' : 'Gemini API Key is not configured.');
      return;
    }
    if (canvasRef.current?.isEmpty()) {
      showErrorModal('Input Error', 'Please draw a sketch before generating an image.');
      return;
    }
    const imageDataUrl = canvasRef.current?.getImageDataUrl();
    if (!imageDataUrl) {
      showErrorModal('Error', 'Could not get sketch data.');
      return;
    }

    const stylePrompt = selectedStyle === CUSTOM_STYLE_KEY ? customStyle : selectedStyle;
    if (!stylePrompt && !customStyleImage) {
      showErrorModal('Input Error', 'Please enter a description of the style or attach an image file as a reference for the style.');
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);
    setImageHistory([]);
    setImageHistoryPointer(-1);

    try {
      const resultImageUrl = await transformSketch(apiKey, imageDataUrl, stylePrompt, customStyleImage);
      setGeneratedImage(resultImageUrl);
      setImageHistory([resultImageUrl]);
      setImageHistoryPointer(0);
    } catch (e) {
      handleApiError(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditClick = async () => {
    if (!apiKey) {
      showErrorModal('API Key Missing', SHOW_API_KEY_INPUT ? 'Please enter your Gemini API Key above.' : 'Gemini API Key is not configured.');
      return;
    }
    if (!imageEditorRef.current) {
        showErrorModal('Error', 'Image editor is not available.');
        return;
    }
    if (!inpaintingPrompt) {
        showErrorModal('Input Error', 'Please enter a description for the edit.');
        return;
    }
    
    const editedImageDataUrl = imageEditorRef.current.getEditedImageDataUrl();
    if (!editedImageDataUrl) {
        showErrorModal('Error', 'Could not get edited image data.');
        return;
    }

    setIsEditing(true);

    try {
        const resultImageUrl = await editImage(apiKey, editedImageDataUrl, inpaintingPrompt);
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

  const handleCopyImage = () => {
    if (!generatedImage) return;

    const blobPromise = fetch(generatedImage).then(res => res.blob());
    const mimeType = generatedImage.match(/data:(.*);/)?.[1] ?? 'image/png';

    navigator.clipboard.write([
        new ClipboardItem({
            [mimeType]: blobPromise
        })
    ]).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }).catch(error => {
        console.error('Failed to copy image:', error);
        let message = 'Could not copy the image to the clipboard.';
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                message = 'Clipboard permission was denied. Please allow clipboard access in your browser settings.';
            } else {
                message = `An error occurred: ${error.message}`;
            }
        }
        showErrorModal('Copy Failed', message);
    });
  };

  const handleStyleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomStyleImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleStyleSelection = (style: string) => {
    setSelectedStyle(style);
    if (style !== CUSTOM_STYLE_KEY) {
      setCustomStyleImage(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-8 select-none">
      
      {isModalOpen && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md text-center border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-red-400 mb-4 select-text">{modalTitle}</h3>
            <p className="text-gray-300 mb-6 select-text">{modalMessage}</p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <header className="w-full max-w-6xl text-center mb-6 md:mb-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          AI Sketch Transformer
        </h1>
        <p className="text-gray-400 mt-2 text-md sm:text-lg">
          Transform your simple sketches into stunning images.
        </p>
      </header>

      {SHOW_API_KEY_INPUT && (
        <div className="w-full max-w-6xl mb-8 p-6 bg-gray-800 rounded-xl shadow-2xl">
          <label htmlFor="apiKey" className="block text-lg font-semibold mb-2 text-gray-300">Gemini API Key</label>
          <input 
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your API key here"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
          <p className="text-sm text-gray-400 mt-2">
              Don't have an API key?{' '}
              <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-purple-400 hover:underline"
              >
                  Get one from Google AI Studio.
              </a>
          </p>
        </div>
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
                  onClick={() => handleStyleSelection(style)}
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
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                  placeholder="Describe your custom style..."
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                 <div className="p-3 bg-gray-700/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Optional: Upload Style Image</h4>
                  {!customStyleImage ? (
                    <label htmlFor="style-image-upload" className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                      <div className="text-center">
                        <PhotoIcon className="mx-auto h-8 w-8 text-gray-500" />
                        <p className="mt-1 text-sm text-gray-400">Click to upload a reference image</p>
                      </div>
                      <input 
                        id="style-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleStyleImageUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative w-full aspect-video bg-gray-900/50 rounded-md">
                      <img src={customStyleImage} alt="Style reference" className="rounded-md object-contain w-full h-full" />
                      <button
                        onClick={() => setCustomStyleImage(null)}
                        className="absolute top-1 right-1 bg-gray-900/70 text-white rounded-full p-1 hover:bg-red-600 transition-all"
                        aria-label="Remove style image"
                      >
                        <XCircleIcon className="w-6 h-6" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
            {!isLoading && !generatedImage && (
              <p className="text-gray-500">Your generated image will appear here.</p>
            )}
             {!isLoading && generatedImage && (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <ImageEditor 
                  ref={imageEditorRef} 
                  imageUrl={generatedImage} 
                  onHistoryChange={handleEditorHistoryChange}
                  isEditing={isEditing}
                />
              </div>
            )}
          </div>
          
          {generatedImage && !isLoading && (
            <div className='flex flex-col gap-3'>
                <h3 className="text-lg font-semibold text-gray-300">Edit Image</h3>
                <p className="text-sm text-gray-400">
                    Erase the part of the image you want to change, then describe the changes below.
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
                    <button
                        onClick={handleCopyImage}
                        disabled={isEditing || copySuccess}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative"
                        aria-label="Copy Image"
                    >
                        <ClipboardIcon className="w-6 h-6" />
                        {copySuccess && (
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                                Copied!
                            </span>
                        )}
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