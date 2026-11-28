"use client";

import { playSound } from "@/lib/sound-fx";

type IosCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "md" | "sm";
  standalone?: boolean;
  ariaLabel?: string;
};

export default function IosCheckbox({
  checked,
  onChange,
  disabled = false,
  size = "md",
  standalone = false,
  ariaLabel,
}: IosCheckboxProps) {
  const inner = (
    <>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => {
          playSound("click");
          onChange(event.target.checked);
        }}
      />
      <span className="checkbox-wrapper" aria-hidden="true">
        <span className="checkbox-bg" />
        <svg className="checkbox-icon" viewBox="0 0 24 24" fill="none">
          <path
            className="check-path"
            d="M4 12L10 18L20 6"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );

  const className = `ios-checkbox red ${size === "sm" ? "is-sm" : ""} ${disabled ? "is-disabled" : ""}`;
  if (standalone) {
    return <label className={className}>{inner}</label>;
  }
  return <span className={className}>{inner}</span>;
}
