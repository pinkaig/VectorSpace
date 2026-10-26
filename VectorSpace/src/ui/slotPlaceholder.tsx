/**
 * @file        slotPlaceholder.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Temporary labelled box that marks an empty layout slot.
 *              DO NOT build your section in this file or edit it.
 *              Instead:
 *                1. Create your section in src/sections/<name>/.
 *                2. In EditorPage, replace your slot's
 *                   <SlotPlaceholder label="..." /> with your component.
 *              Delete this file once no slot uses it anymore.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import "./slotPlaceholder.css";

type SlotPlaceholderProps = {
  label: string;
};

export function SlotPlaceholder({ label }: SlotPlaceholderProps) {
  return <div className="slot-placeholder">{label}</div>;
}
