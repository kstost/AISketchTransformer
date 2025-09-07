import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface ImageEditorHandles {
  getEditedImageDataUrl: () => string | undefined;
  undo: () => void;
  redo: () => void;
}

interface ImageEditorProps {
  imageUrl: string;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  mode: 'draw' | 'erase';
}

const ImageEditor = forwardRef<ImageEditorHandles, ImageEditorProps>(({ imageUrl, onHistoryChange, mode }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const history = useRef<ImageData[]>([]);
  const historyPointer = useRef(-1);

  const saveState = useCallback(() => {
    if (!context || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    if (historyPointer.current < history.current.length - 1) {
      history.current.splice(historyPointer.current + 1);
    }

    history.current.push(imageData);
    historyPointer.current = history.current.length - 1;

    onHistoryChange(historyPointer.current > 0, false);
  }, [context, onHistoryChange]);

  const restoreState = useCallback(() => {
    if (!context || history.current.length === 0 || historyPointer.current < 0) return;
    const imageData = history.current[historyPointer.current];
    context.putImageData(imageData, 0, 0);
    onHistoryChange(historyPointer.current > 0, historyPointer.current < history.current.length - 1);
  }, [context, onHistoryChange]);

  // Load image from URL
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Handle potential CORS issues if image is from another domain
    img.src = imageUrl;
    img.onload = () => setImage(img);
    img.onerror = () => console.error("Failed to load image for editor.");
  }, [imageUrl]);

  // Initialize canvas and draw image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !image || !ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.drawImage(image, 0, 0, image.width, image.height);
    setContext(ctx);

    // Reset history when a new image is loaded and save initial state
    history.current = [];
    historyPointer.current = -1;
    setTimeout(() => {
      if (canvasRef.current?.getContext('2d')) {
        saveState();
      }
    }, 0);

  }, [image, saveState]);

  // Handle canvas display resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const handleResize = () => {
        const aspectRatio = image.width / image.height;
        const parent = canvas.parentElement?.parentElement; // The container div of the mode selector and canvas
        if (!parent) return;
        
        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;
        const parentAspect = parentWidth / parentHeight;

        let displayWidth, displayHeight;

        if (aspectRatio > parentAspect) {
            displayWidth = parentWidth;
            displayHeight = parentWidth / aspectRatio;
        } else {
            displayHeight = parentHeight;
            displayWidth = parentHeight * aspectRatio;
        }

        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current || !context) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!context || !canvasRef.current) return;
    setIsInteracting(true);
    const coords = getCoords(e);
    if (!coords) return;

    if (mode === 'draw') {
        context.globalCompositeOperation = 'source-over';
        const scale = canvasRef.current.width / canvasRef.current.getBoundingClientRect().width;
        context.lineWidth = 5 * scale;
        context.strokeStyle = '#FF00FF'; // Magenta for high visibility
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(coords.x, coords.y);
    }
    // Erase on first click/touch
    handleInteraction(e);
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isInteracting || !context || !canvasRef.current) return;
    e.preventDefault();
    const coords = getCoords(e);
    if (!coords) return;

    if (mode === 'draw') {
        context.lineTo(coords.x, coords.y);
        context.stroke();
    } else { // 'erase'
        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        const scale = canvasRef.current.width / canvasRef.current.getBoundingClientRect().width;
        context.arc(coords.x, coords.y, 20 * scale, 0, Math.PI * 2, false);
        context.fill();
    }
  };

  const stopInteraction = () => {
    if (!isInteracting || !context) return;
    if (mode === 'draw') {
        context.closePath();
    }
    setIsInteracting(false);
    saveState();
  };

  useImperativeHandle(ref, () => ({
    getEditedImageDataUrl: () => {
      return canvasRef.current?.toDataURL('image/png');
    },
    undo: () => {
      if (historyPointer.current > 0) {
        historyPointer.current--;
        restoreState();
      }
    },
    redo: () => {
      if (historyPointer.current < history.current.length - 1) {
        historyPointer.current++;
        restoreState();
      }
    }
  }));

  return (
    <div className='w-full h-full flex flex-col items-center justify-center'>
      <canvas
        ref={canvasRef}
        onMouseDown={startInteraction}
        onMouseMove={handleInteraction}
        onMouseUp={stopInteraction}
        onMouseLeave={stopInteraction}
        onTouchStart={startInteraction}
        onTouchMove={handleInteraction}
        onTouchEnd={stopInteraction}
        className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-crosshair"
        style={{ 
            touchAction: 'none',
            backgroundImage: `
              linear-gradient(45deg, #808080 25%, transparent 25%), 
              linear-gradient(-45deg, #808080 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #808080 75%), 
              linear-gradient(-45deg, transparent 75%, #808080 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            backgroundColor: '#a9a9a9'
        }}
      />
    </div>
  );
});

export default ImageEditor;
