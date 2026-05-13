import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, ImageIcon, Video, FlipHorizontal, CheckCircle2 } from 'lucide-react';
import { toast } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';

interface CustomCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CustomCamera({ onCapture, onClose }: CustomCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackCameraPhotoRef = useRef<HTMLInputElement>(null);
  const fallbackCameraVideoRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (err) {
      console.error('Error accessing media devices:', err);
      // Fallback to video only if audio fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (fallbackErr) {
        console.error('Error accessing camera:', fallbackErr);
        setHasPermission(false);
        toast.error('Could not access camera. Please check permissions.');
      }
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, [startCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // If using front camera, mirror the image
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        // Visual feedback
        const flash = document.createElement('div');
        flash.className = 'absolute inset-0 bg-white z-50 animate-out fade-out duration-300';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 300);
      }
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    recordedChunksRef.current = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, options);
    } catch (e) {
      // Fallback
      recorder = new MediaRecorder(streamRef.current);
    }
    
    mediaRecorderRef.current = recorder;
    
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
      const file = new File([blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
      onCapture(file);
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
    
    recorder.start();
    setIsRecording(true);
    
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Start a timer to determine if it's a tap or hold
    e.preventDefault();
    holdTimerRef.current = setTimeout(() => {
      startRecording();
    }, 400); // 400ms hold means video
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    if (isRecording) {
      stopRecording();
    } else {
      capturePhoto();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        onCapture(file);
      });
      // Optionally close the camera view after picking from gallery
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
      {/* Header / Controls */}
      <div className="absolute top-0 inset-x-0 p-4 sm:p-6 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-md"
        >
          <X className="h-6 w-6" />
        </button>
        {isRecording && (
          <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1.5 rounded-full backdrop-blur-md">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-mono text-sm font-medium">{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {/* Viewport */}
      <div className="relative w-full h-full max-w-lg mx-auto bg-black flex items-center justify-center overflow-hidden">
        {hasPermission === false ? (
          <div className="text-center p-6 text-white/80 max-w-sm mx-auto">
            <Camera className="h-16 w-16 mx-auto mb-4 text-white/40" />
            <h3 className="text-lg font-bold mb-2">Live Camera Unavailable</h3>
            <p className="text-sm text-white/60 mb-8 leading-relaxed">
              Your browser blocked direct camera access. This usually happens when testing on a local network (HTTP instead of HTTPS) or if permissions were denied.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => fallbackCameraPhotoRef.current?.click()}
                className="bg-white text-black hover:bg-slate-200 font-bold py-3.5 px-6 rounded-full w-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xl"
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </button>
              <button 
                onClick={() => fallbackCameraVideoRef.current?.click()}
                className="bg-rose-500 text-white hover:bg-rose-600 font-bold py-3.5 px-6 rounded-full w-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xl"
              >
                <Video className="h-5 w-5" />
                Record Video
              </button>
            </div>
            
            <input 
              type="file" 
              ref={fallbackCameraPhotoRef} 
              className="hidden" 
              accept="image/*" 
              capture="environment" 
              onChange={handleGalleryUpload} 
            />
            <input 
              type="file" 
              ref={fallbackCameraVideoRef} 
              className="hidden" 
              accept="video/*" 
              capture="environment" 
              onChange={handleGalleryUpload} 
            />
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={cn("w-full h-full object-cover", facingMode === 'user' && "scale-x-[-1]")}
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 inset-x-0 pb-8 pt-12 px-6 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-end">
        <div className="text-white/70 text-xs font-medium mb-6 px-4 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
          Tap for photo, hold for video
        </div>
        
        <div className="w-full max-w-sm flex items-center justify-between">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-md"
          >
            <ImageIcon className="h-6 w-6" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*,video/*" 
            onChange={handleGalleryUpload} 
          />

          {/* Shutter Button */}
          <div 
            className="relative flex items-center justify-center"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div className={cn(
              "absolute inset-0 rounded-full transition-all duration-300",
              isRecording ? "scale-[1.3] bg-red-500/20" : "scale-100 bg-white/20"
            )} />
            <div className={cn(
              "relative rounded-full border-[4px] flex items-center justify-center transition-all duration-300",
              isRecording ? "h-20 w-20 border-red-500" : "h-20 w-20 border-white"
            )}>
              <div className={cn(
                "rounded-full transition-all duration-300",
                isRecording ? "h-6 w-6 bg-red-500 rounded-sm" : "h-16 w-16 bg-white"
              )} />
            </div>
          </div>

          <button 
            onClick={toggleCamera}
            className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-md"
          >
            <FlipHorizontal className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
