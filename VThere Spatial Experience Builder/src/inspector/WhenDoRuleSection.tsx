/**
 * @file        WhenDoRuleSection.tsx
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Inspector section for adding a WHEN Click, DO Change colour rule to the selected object
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from 'react'

// ruleCount is how many rules the object has, onAdd gets the picked colour as text like "#ff0000"
export function WhenDoRuleSection({ ruleCount, onAdd }: { ruleCount: number; onAdd: (hex: string) => void }) {
  // the picked colour only lives here until Add is pressed, it is not saved project data
  const [hex, setHex] = useState('#ff0000')
  return (
    <div className="field-group">
      <span>When / Do</span>
      {/* only one choice each for now, the shared vocabulary list will fill these dropdowns later */}
      <select defaultValue="click">
        <option value="click">When: Click</option>
      </select>
      <select defaultValue="changeColor">
        <option value="changeColor">Do: Change colour</option>
      </select>
      <input type="color" value={hex} onChange={(event) => setHex(event.target.value)} />
      <button className="button subtle" onClick={() => onAdd(hex)}>Add rule</button>
      <span>Rules on this object: {ruleCount}</span>
    </div>
  )
}