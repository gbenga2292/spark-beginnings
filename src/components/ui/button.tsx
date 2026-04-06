import * as React from "react"
import { cn } from "@/src/lib/utils"
import { useNetworkStore } from "@/src/store/networkStore"
import { Lock } from "lucide-react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  disableOffline?: boolean
}

function extractText(children: React.ReactNode): string {
  let text = '';
  React.Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      text += child;
    } else if (React.isValidElement(child) && (child.props as any).children) {
      text += extractText((child.props as any).children);
    }
  });
  return text;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", disableOffline, ...props }, ref) => {
    const isOnline = useNetworkStore((state) => state.connectionStatus) !== 'offline';
    
    // Check if the button represents a mutating action
    const textContent = extractText(props.children);
    const isAction = /\b(add|save|submit|delete|create|update|import|export|upload|remove|checkout|approve|reject)\b/i.test(textContent);
    const autoDisable = props.type === "submit" || variant === "destructive" || isAction;
    
    // Enable forcing opt-out via disableOffline={false}
    const shouldLock = !isOnline && (disableOffline === true || (disableOffline !== false && autoDisable));

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-slate-900 dark:bg-slate-100 text-slate-50 dark:text-slate-900 hover:bg-slate-900/90 dark:hover:bg-slate-100/90": variant === "default",
            "bg-red-500 text-slate-50 hover:bg-red-500/90": variant === "destructive",
            "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 text-slate-700 dark:text-slate-300": variant === "outline",
            "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-700/80": variant === "secondary",
            "hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400": variant === "ghost",
            "text-slate-900 dark:text-slate-100 underline-offset-4 hover:underline": variant === "link",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
            "cursor-not-allowed border-dashed relative": shouldLock,
          },
          className
        )}
        ref={ref}
        {...props}
        disabled={props.disabled || shouldLock}
      >
        {shouldLock && <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-500 bg-slate-200/50 rounded-full p-0.5" />}
        {props.children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
