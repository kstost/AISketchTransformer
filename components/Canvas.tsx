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

interface Point {
    x: number;
    y: number;
}

interface Stroke {
    points: Point[];
    // In a real app, you'd store color, lineWidth, etc. here too
}

const Canvas = forwardRef<CanvasHandles, CanvasProps>(({ onHistoryChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Use a ref to store strokes to avoid re-renders on every point added
  const strokes = useRef<Stroke[]>([]);
  const historyPointer = useRef(-1);

  const updateHistoryButtons = useCallback(() => {
      onHistoryChange(historyPointer.current >= 0, historyPointer.current < strokes.current.length - 1);
  }, [onHistoryChange]);


  const redrawCanvas = useCallback(() => {
    if (!context || !canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // The canvas is scaled by DPR, so we use the CSS dimensions for clearing.
    const rect = canvas.getBoundingClientRect();
    
    // Clear canvas with background color
    context.fillStyle = '#1a202c';
    context.fillRect(0, 0, rect.width, rect.height);
    
    // Redraw strokes from history up to the current pointer
    context.strokeStyle = '#f7fafc';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    for (let i = 0; i <= historyPointer.current; i++) {
        const stroke = strokes.current[i];
        if (!stroke || stroke.points.length < 2) continue;
        
        context.beginPath();
        context.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let j = 1; j < stroke.points.length; j++) {
            context.lineTo(stroke.points[j].x, stroke.points[j].y);
        }
        context.stroke();
    }
  }, [context]);

  // Setup canvas, context, and resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setContext(ctx);

    const handleResize = () => {
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Reset transform and apply scaling for high-DPI displays
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        redrawCanvas();
    };

    handleResize(); // Initial setup
    window.addEventListener('resize', handleResize);

    // Initial history state for a blank canvas
    updateHistoryButtons();

    return () => {
        window.removeEventListener('resize', handleResize);
    };
  }, [context, redrawCanvas, updateHistoryButtons]); // Dependencies for setup

  const getCoords = (e: React.MouseEvent | React.TouchEvent): Point | null => {
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
      setIsDrawing(true);
      
      // If we've undone, and now draw a new line, we clear the 'redo' history.
      if (historyPointer.current < strokes.current.length - 1) {
          strokes.current.splice(historyPointer.current + 1);
      }

      const newStroke: Stroke = { points: [coords] };
      strokes.current.push(newStroke);
      historyPointer.current = strokes.current.length - 1;

      context.beginPath();
      context.moveTo(coords.x, coords.y);
      
      updateHistoryButtons();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !context) return;
    e.preventDefault();
    const coords = getCoords(e);
    if (coords) {
      // Add point to the current stroke in our history
      strokes.current[strokes.current.length - 1].points.push(coords);
      // Draw on canvas for immediate feedback
      context.lineTo(coords.x, coords.y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !context) return;
    context.closePath();
    setIsDrawing(false);
  };
  
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      strokes.current = [];
      historyPointer.current = -1;
      redrawCanvas();
      updateHistoryButtons();
    },
    getImageDataUrl: () => {
      // Ensure canvas is redrawn before exporting to capture only the visible state
      redrawCanvas(); 
      return canvasRef.current?.toDataURL('image/png');
    },
    isEmpty: () => historyPointer.current < 0,
    undo: () => {
      if (historyPointer.current >= 0) {
        historyPointer.current--;
        redrawCanvas();
        updateHistoryButtons();
      }
    },
    redo: () => {
       if (historyPointer.current < strokes.current.length - 1) {
        historyPointer.current++;
        redrawCanvas();
        updateHistoryButtons();
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