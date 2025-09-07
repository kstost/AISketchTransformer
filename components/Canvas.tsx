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
  const [hasDrawing, setHasDrawing] = useState(false);
  
  const history = useRef<ImageData[]>([]);
  const historyPointer = useRef(-1);

  const saveState = useCallback(() => {
    if (!context || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // If we've undone and then draw something new, clear the 'redo' history
    if (historyPointer.current < history.current.length - 1) {
      history.current.splice(historyPointer.current + 1);
    }
    
    history.current.push(imageData);
    historyPointer.current = history.current.length - 1;
    
    onHistoryChange(historyPointer.current > 0, false);
  }, [context, onHistoryChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#f7fafc'; // light gray/white
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.fillStyle = '#1a202c'; // even darker gray
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setContext(ctx);

    // Save initial blank state
    // Use timeout to ensure canvas is painted before capturing
    setTimeout(() => {
        if (canvas.getContext('2d')) { // Check if context still exists
             saveState();
        }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoords(e);
    if (context && coords) {
      context.beginPath();
      context.moveTo(coords.x, coords.y);
      setIsDrawing(true);
      setHasDrawing(true);
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
    saveState();
  };

  const restoreState = useCallback(() => {
    if (!context || history.current.length === 0 || historyPointer.current < 0) return;
    const imageData = history.current[historyPointer.current];
    context.putImageData(imageData, 0, 0);
    onHistoryChange(historyPointer.current > 0, historyPointer.current < history.current.length - 1);
  }, [context, onHistoryChange]);
  
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      if (context && canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const width = canvasRef.current.width / dpr;
        const height = canvasRef.current.height / dpr;
        
        context.fillStyle = '#1a202c';
        context.fillRect(0, 0, width, height);
        setHasDrawing(false);

        // Reset history and save the blank state
        history.current = [];
        historyPointer.current = -1;
        saveState();
      }
    },
    getImageDataUrl: () => {
      return canvasRef.current?.toDataURL('image/png');
    },
    isEmpty: () => !hasDrawing,
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
      className="w-full h-full rounded-lg shadow-lg cursor-crosshair bg-gray-800"
    />
  );
});

export default Canvas;