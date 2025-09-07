import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface CanvasHandles {
  clearCanvas: () => void;
  getImageDataUrl: () => string | undefined;
  isEmpty: () => boolean;
  undo: () => void;
  redo: () => void;
  drawImageFromUrl: (imageUrl: string) => void;
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
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    setContext(ctx);

    const handleResize = () => {
        // Get the last committed state from history.
        const lastState = history.current[historyPointer.current];

        // Create an in-memory canvas to hold the last state's image data.
        // This avoids reading from the main canvas, which prevents cumulative blurriness.
        const tempCanvas = document.createElement('canvas');
        if (lastState) {
            tempCanvas.width = lastState.width;
            tempCanvas.height = lastState.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx?.putImageData(lastState, 0, 0);
        }

        // Resize the main canvas to fit its container, accounting for device pixel ratio.
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Restore drawing context styles, as they are reset on resize.
        ctx.strokeStyle = '#f7fafc'; // light gray/white
        ctx.lineWidth = 3 * dpr;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Redraw the canvas content.
        if (lastState) {
            // Draw the preserved state from the temp canvas, scaling it to the new size.
            // This is a single, clean scaling operation from the original-quality source.
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        } else {
            // If there's no history, it's the initial setup. Fill with the background color.
            ctx.fillStyle = '#1a202c'; // even darker gray
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Save this initial blank state to start the history.
            setTimeout(() => {
                // Check context exists in case component unmounted quickly
                if (canvas.getContext('2d')) { 
                    saveState();
                }
            }, 0);
        }
    };
    
    handleResize(); // Call once for initial setup.
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty to run only on mount.

  const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
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
        context.fillStyle = '#1a202c';
        context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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
    },
    drawImageFromUrl: (imageUrl: string) => {
      if (!context || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const img = new Image();
      img.onload = () => {
        context.fillStyle = '#1a202c';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const canvasAspect = canvas.width / canvas.height;
        const imageAspect = img.width / img.height;

        let destWidth, destHeight, destX, destY;

        if (imageAspect > canvasAspect) {
          destWidth = canvas.width;
          destHeight = canvas.width / imageAspect;
          destX = 0;
          destY = (canvas.height - destHeight) / 2;
        } else {
          destHeight = canvas.height;
          destWidth = canvas.height * imageAspect;
          destY = 0;
          destX = (canvas.width - destWidth) / 2;
        }

        context.drawImage(img, destX, destY, destWidth, destHeight);
        setHasDrawing(true);
        saveState();
      };
      img.src = imageUrl;
    },
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