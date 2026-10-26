/**
 * @file        RecentlyPublishedSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       Overview section: the museums that went live most recently. View and Unpublish
 *              are drawn but have no routes behind them, so they only post a notice.
 *
 * @boundary
 * The mock-up gives each row a visit count and an access level (Public / Unlisted / Sign-in
 * only). Neither exists: nothing counts visits, and nothing records how a museum is shared.
 * Rather than print an invented number, the row shows when it was published. Put those two
 * columns back when there is an analytics table and a sharing model to read them from.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { PublishedItem } from "../../../api/admin";
import { Button } from "../../../ui/button";
import { useNoLogic } from "../../../ui/noLogic";

const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : "unknown");

export function RecentlyPublishedSection({ items }: { items: PublishedItem[] }) {
  const [noLogic, noLogicPopup] = useNoLogic();
  return (
    <section className="admin-panel admin-overview-recent">
      <div className="admin-panel-head"><h2>Recently published</h2></div>
      <div className="admin-scroll">
        {items.length === 0 && <p className="admin-overview-empty">Nothing has been published yet.</p>}
        <table className="admin-table">
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  <div className="admin-muted">{item.where}</div>
                </td>
                <td>Published {when(item.publishedAt)}</td>
                <td className="admin-actions">
                  <Button size="small" onClick={() => noLogic(`View ${item.title}`)}>View</Button>
                  <Button size="small" variant="danger" onClick={() => noLogic(`Unpublish ${item.title}`)}>Unpublish</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noLogicPopup}
    </section>
  );
}
