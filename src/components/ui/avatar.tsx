import * as React from "react"
import { cn } from "@/src/lib/utils"

const AvatarContext = React.createContext<{
  imageLoadingStatus: 'idle' | 'loading' | 'loaded' | 'error';
  onImageLoadingStatusChange: (status: 'idle' | 'loading' | 'loaded' | 'error') => void;
}>({
  imageLoadingStatus: 'idle',
  onImageLoadingStatusChange: () => {},
});

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const [imageLoadingStatus, onImageLoadingStatusChange] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  return (
    <AvatarContext.Provider value={{ imageLoadingStatus, onImageLoadingStatusChange }}>
      <div ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
    </AvatarContext.Provider>
  )
})
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(({ className, src, ...props }, ref) => {
  const { imageLoadingStatus, onImageLoadingStatusChange } = React.useContext(AvatarContext);
  
  React.useEffect(() => {
    if (!src) {
      onImageLoadingStatusChange('error');
    } else {
      onImageLoadingStatusChange('loading');
    }
  }, [src, onImageLoadingStatusChange]);

  const handleLoad = React.useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      onImageLoadingStatusChange('loaded');
      if (props.onLoad) props.onLoad(e);
    },
    [onImageLoadingStatusChange, props.onLoad]
  );

  const handleError = React.useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      onImageLoadingStatusChange('error');
      if (props.onError) props.onError(e);
    },
    [onImageLoadingStatusChange, props.onError]
  );

  if (!src || imageLoadingStatus === 'error') return null;

  return (
    <img 
      ref={ref} 
      src={src}
      className={cn("aspect-square h-full w-full object-cover", imageLoadingStatus !== 'loaded' && 'hidden', className)} 
      onLoad={handleLoad}
      onError={handleError}
      {...props} 
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const { imageLoadingStatus } = React.useContext(AvatarContext);
  
  if (imageLoadingStatus === 'loaded') {
    return null;
  }

  return (
    <div ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-slate-100", className)} {...props} />
  )
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
