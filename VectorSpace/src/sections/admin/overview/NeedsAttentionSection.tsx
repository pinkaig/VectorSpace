/**
 * @file        NeedsAttentionSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Overview section: things that need an admin, each with one button that
 *              jumps to the page that fixes it. "Review" has no page yet, so it is off.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useNavigate } from "react-router";
import type { AttentionItem } from "../../../api/admin";
import { Button } from "../../../ui/button";

export function NeedsAttentionSection({ items }: { items: AttentionItem[] }) {
  const navigate = useNavigate();
  return (
    <section className="admin-panel admin-overview-attention">
      <div className="admin-panel-head"><h2>Needs your attention</h2></div>
      <div className="admin-scroll">
        {items.length === 0 && <p className="admin-overview-empty">Nothing needs you right now.</p>}
        {items.map((item) => (
          <div key={item.id} className="admin-overview-item">
            <span>{item.text}</span>
            <Button
              size="small"
              disabled={!item.goTo}
              title={item.goTo ? undefined : "Reviewing a reported museum is not built yet"}
              onClick={() => item.goTo && navigate(`/admin/${item.goTo}`)}
            >
              {item.actionLabel}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
