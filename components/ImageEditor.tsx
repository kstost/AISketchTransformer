import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface ImageEditorHandles {
  getEditedImageDataUrl: () => string | undefined;
  undo: () => void;
  redo: () => void;
}

interface ImageEditorProps {
  imageUrl: string;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
}

const ImageEditor = forwardRef<ImageEditorHandles, ImageEditorProps>(({ imageUrl, onHistoryChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isErasing, setIsErasing] = useState(false);
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
    if (!canvas || !image) return;

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size for display, maintaining aspect ratio
    const aspectRatio = image.width / image.height;
    const parentWidth = canvas.parentElement?.clientWidth || image.width;
    const displayWidth = Math.min(image.width, parentWidth);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayWidth / aspectRatio}px`;

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

  const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current || !context) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Translate coordinates from display size to actual canvas resolution
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startErasing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsErasing(true);
    const coords = getCoords(e);
    if (coords) {
        erase(e); // Start erasing immediately on click/touch
    }
  };

  const erase = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isErasing || !context) return;
    e.preventDefault();
    const coords = getCoords(e);
    if (coords) {
      context.globalCompositeOperation = 'destination-out';
      context.beginPath();
      context.arc(coords.x, coords.y, 40, 0, Math.PI * 2, false); // 40px radius brush (doubled)
      context.fill();
    }
  };

  const stopErasing = () => {
    if (!isErasing || !context) return;
    context.globalCompositeOperation = 'source-over'; // Reset to default
    setIsErasing(false);
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
    <canvas
      ref={canvasRef}
      onMouseDown={startErasing}
      onMouseMove={erase}
      onMouseUp={stopErasing}
      onMouseLeave={stopErasing}
      onTouchStart={startErasing}
      onTouchMove={erase}
      onTouchEnd={stopErasing}
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
  );
});

export default ImageEditor;
