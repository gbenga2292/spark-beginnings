import { IconProps } from 'lucide-react';

export function NairaSign({ color = 'currentColor', size = 24, strokeWidth = 2, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M6 18V6l12 12V6" />
      <path d="M4 10h16" />
      <path d="M4 14h16" />
    </svg>
  );
}
