/**
 * @file        button.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The V3 button: one component, so every page gets the same sizes and colours.
 *              Variants and sizes are the manual's (primary, secondary, danger, add).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ButtonHTMLAttributes } from "react";
import "./button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  // primary: the one purple action of a screen; secondary: white with a border;
  // danger: small red text for turning something off; add: dashed "+ Add ..." button
  variant?: "primary" | "secondary" | "danger" | "add";
  size?: "normal" | "small";
};

export function Button({ variant = "secondary", size = "normal", className = "", ...rest }: ButtonProps) {
  // type="button" so a button inside a form never submits it by accident
  return <button type="button" className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`} {...rest} />;
}
