import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Upload, X, RefreshCw, Sparkles, Check, AlertCircle,
  FlipHorizontal, Image as ImageIcon, Zap, ShieldAlert
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import {
  scanBusinessCardWithAI,
  ExtractedBusinessCardData
} from '@/src/lib/businessCardAiService';

interface BusinessCardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: ExtractedBusinessCardData) => void;
}

export function BusinessCardScannerModal({
  isOpen,
  onClose,
  onScanComplete
}: BusinessCardScannerModalProps) {
  const { isDark } = useTheme();
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop current camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        setMode('upload');
        toast.error('Camera API is not supported on this device/browser. Please upload an image.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.warn);
      }
      setHasCameraPermission(true);
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setHasCameraPermission(false);
      setMode('upload');
    }
  }, [facingMode, stopCamera]);

  // Manage camera lifecycle based on modal visibility and active tab
  useEffect(() => {
    if (isOpen && mode === 'camera' && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode, capturedImage, startCamera, stopCamera]);

  // Reset state when modal is closed
  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setSelectedFile(null);
    setIsScanning(false);
    setStatusMessage('');
    onClose();
  };

  // Flip camera between front and back
  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Take snapshot from video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setSelectedFile(null);
    if (mode === 'camera') {
      startCamera();
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Trigger AI Business Card Scan
  const handleScan = async () => {
    const source = selectedFile || capturedImage;
    if (!source) {
      toast.error('Please capture or upload a business card photo first.');
      return;
    }

    setIsScanning(true);
    setStatusMessage('Connecting to AI Vision...');

    try {
      const extracted = await scanBusinessCardWithAI(source, (msg) => {
        setStatusMessage(msg);
      });

      toast.success(`Business card scanned! Extracted: ${extracted.name || 'Contact'}`);
      onScanComplete(extracted);
      handleClose();
    } catch (err: any) {
      console.error('Scan error:', err);
      toast.error(err.message || 'Failed to scan business card.');
    } finally {
      setIsScanning(false);
      setStatusMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={cn(
          'relative w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-all',
          isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-5 py-3.5 border-b shrink-0',
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
        )}>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">AI Business Card Scanner</h3>
              <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Snap or upload a card to auto-populate contact details
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isScanning}
            className={cn(
              'rounded-xl p-1.5 transition-colors',
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (only shown if not in preview) */}
        {!capturedImage && (
          <div className="flex items-center gap-1 px-5 pt-3 shrink-0">
            <button
              type="button"
              onClick={() => { setMode('camera'); setCapturedImage(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all',
                mode === 'camera'
                  ? isDark
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
              )}
            >
              <Camera className="w-4 h-4" />
              Live Camera
            </button>
            <button
              type="button"
              onClick={() => { setMode('upload'); stopCamera(); setCapturedImage(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all',
                mode === 'upload'
                  ? isDark
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
              )}
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </button>
          </div>
        )}

        {/* Viewport / Main Content Area */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* 1. Captured Image Preview with AI Scanning Overlay */}
          {capturedImage ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-[16/10] flex items-center justify-center group">
                <img
                  src={capturedImage}
                  alt="Captured Business Card"
                  className="w-full h-full object-contain"
                />

                {/* Animated Scanner Laser Bar */}
                {isScanning && (
                  <div className="absolute inset-0 bg-blue-500/10 pointer-events-none">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6] animate-[bounce_2s_infinite]" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-900/90 border border-blue-500/40 shadow-xl">
                        <Sparkles className="w-8 h-8 text-blue-400 animate-spin" />
                        <span className="text-xs font-semibold text-blue-200 animate-pulse text-center">
                          {statusMessage || 'Analyzing business card with AI...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isScanning && (
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Review photo before scanning</span>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Retake / Pick another
                  </button>
                </div>
              )}
            </div>
          ) : mode === 'camera' ? (
            /* 2. Live Camera Viewfinder */
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[16/10] flex items-center justify-center border border-slate-800">
              {hasCameraPermission === false ? (
                <div className="p-6 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold">Camera Access Unavailable</div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Camera permission is required or no webcam was detected. You can upload a photo of the card instead.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('upload')}
                    className="gap-2 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Switch to Image Upload
                  </Button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Business Card Framing Overlay */}
                  <div className="absolute inset-4 sm:inset-6 border-2 border-dashed border-blue-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-3 bg-blue-500/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-blue-300 bg-slate-900/80 px-2 py-0.5 rounded self-start border border-blue-400/30">
                      Align Business Card Here
                    </div>
                    <div className="text-[10px] text-center text-blue-200/80 bg-slate-900/60 py-0.5 rounded self-center px-2">
                      Ensure good lighting & crisp text
                    </div>
                  </div>

                  {/* Camera Control Overlays */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      title="Switch camera"
                      className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors shadow-lg"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* 3. Drag and Drop File Upload Area */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all aspect-[16/10] flex flex-col items-center justify-center gap-3',
                isDragging
                  ? 'border-blue-500 bg-blue-500/10'
                  : isDark
                    ? 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-600'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                <ImageIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  Click to select or drag and drop photo
                </div>
                <div className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  PNG, JPG, JPEG or WebP up to 15MB
                </div>
              </div>
            </div>
          )}

          {/* Hidden Canvas for Video Snapshot */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Modal Actions Footer */}
        <div className={cn(
          'flex items-center justify-between px-5 py-3.5 border-t shrink-0',
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
        )}>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isScanning}
            className="text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!capturedImage && mode === 'camera' && hasCameraPermission !== false && (
              <Button
                type="button"
                onClick={capturePhoto}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs shadow-xs"
              >
                <Camera className="w-4 h-4" /> Snap Photo
              </Button>
            )}

            {capturedImage && (
              <Button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs shadow-xs font-semibold"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Scanning Card...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Scan & Fill Form with AI
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
