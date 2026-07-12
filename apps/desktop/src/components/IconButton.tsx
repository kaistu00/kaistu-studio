import type { ReactNode, ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label?: string;
  iconOnly?: boolean;
  iconClass?: string;
  labelClass?: string;
  children?: ReactNode;
}

const isEmoji = (s: string) => /^[\u{1F300}-\u{1F9FF}]|\uD83C|\u2600-\u26FF$/u.test(s);

export function IconButton({
  icon, label, iconOnly, iconClass = "", labelClass = "", className = "", children, ...rest
}: IconButtonProps) {
  const iconIsEmoji = isEmoji(icon);
  return (
    <button className={`icon-btn${iconOnly ? " icon-btn--icon-only" : ""} ${className}`} {...rest}>
      <span className={iconIsEmoji ? `icon-btn-icon ${iconClass}` : `material-symbols-outlined icon-btn-icon ${iconClass}`}>{icon}</span>
      {label && <span className={`icon-btn-label ${labelClass}`}>{label}</span>}
      {children}
    </button>
  );
}
