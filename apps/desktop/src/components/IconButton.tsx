import type { ReactNode, ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label?: string;
  iconOnly?: boolean;
  iconClass?: string;
  labelClass?: string;
  children?: ReactNode;
}

export function IconButton({
  icon, label, iconOnly, iconClass = "", labelClass = "", className = "", children, ...rest
}: IconButtonProps) {
  return (
    <button className={`icon-btn${iconOnly ? " icon-btn--icon-only" : ""} ${className}`} {...rest}>
      <span className={`material-symbols-outlined icon-btn-icon ${iconClass}`}>{icon}</span>
      {label && <span className={`icon-btn-label ${labelClass}`}>{label}</span>}
      {children}
    </button>
  );
}
