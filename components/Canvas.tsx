
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface CanvasHandles {
  clearCanvas: () => void;
  getImageDataUrl: () => string | undefined;
  isEmpty: () => boolean;
  undo: () => void;
  redo: () => void;
}

interface CanvasProps {
    onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
}

const Canvas = forwardRef<CanvasHandles, CanvasProps>(({ onHistoryChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
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

  // Setup canvas and context. Runs once on mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set a fixed, high resolution for the canvas. CSS will handle display scaling.
    const resolution = 1024;
    canvas.width = resolution;
    canvas.height = resolution;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setContext(ctx);
  }, []);

  // Initialize canvas state when context is ready.
  useEffect(() => {
    if (!context || !canvasRef.current) return;
    const canvas = canvasRef.current;

    context.strokeStyle = '#f7fafc';
    context.lineWidth = 5; // Adjusted for higher resolution
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    // Clear canvas and save initial blank state to history
    context.fillStyle = '#1a202c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    history.current = [];
    historyPointer.current = -1;
    saveState();
    onHistoryChange(false, false);
  }, [context, onHistoryChange, saveState]);
  
  // Add paste event listener
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
        if (!context || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (!blob) continue;

                event.preventDefault();

                const img = new Image();
                img.onload = () => {
                    // Fit image to canvas by scaling to fit and centering
                    const canvasAspect = canvas.width / canvas.height;
                    const imgAspect = img.width / img.height;

                    let dWidth, dHeight, dx, dy;

                    if (imgAspect > canvasAspect) {
                        // Image is wider than canvas, so fit to width
                        dWidth = canvas.width;
                        dHeight = dWidth / imgAspect;
                        dx = 0;
                        dy = (canvas.height - dHeight) / 2;
                    } else {
                        // Image is taller than or has the same aspect as canvas, so fit to height
                        dHeight = canvas.height;
                        dWidth = dHeight * imgAspect;
                        dy = 0;
                        dx = (canvas.width - dWidth) / 2;
                    }

                    // Clear canvas before drawing the new image
                    context.fillStyle = '#1a202c';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    
                    context.drawImage(img, 0, 0, img.width, img.height, dx, dy, dWidth, dHeight);
                    URL.revokeObjectURL(img.src);
                    saveState(); // Save the pasted image as a new state in history
                };
                img.src = URL.createObjectURL(blob);
                return; // Only paste the first image found
            }
        }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [context, saveState]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Translate coordinates from display size to actual canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoords(e);
    if (context && coords) {
      setIsDrawing(true);
      context.beginPath();
      context.moveTo(coords.x, coords.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !context) return;
    e.preventDefault();
    const coords = getCoords(e);
    if (coords) {
      context.lineTo(coords.x, coords.y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !context) return;
    context.closePath();
    setIsDrawing(false);
    saveState(); // Save state after a stroke is completed
  };
  
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      if (!context || !canvasRef.current) return;
      const canvas = canvasRef.current;
      context.fillStyle = '#1a202c';
      context.fillRect(0, 0, canvas.width, canvas.height);
      history.current = [];
      historyPointer.current = -1;
      saveState();
      onHistoryChange(false, false);
    },
    getImageDataUrl: () => {
      return canvasRef.current?.toDataURL('image/png');
    },
    isEmpty: () => historyPointer.current <= 0,
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
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      className="w-full h-full rounded-lg shadow-lg cursor-crosshair bg-gray-800 object-contain"
      style={{ touchAction: 'none' }}
    />
  );
});

export default Canvas;
