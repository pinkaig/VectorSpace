/**
 * @file        PickSchoolNotice.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Shown instead of a page's content when All schools is picked on a page that
 *              only makes sense for one school (Permissions, Rooms & assets).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

export function PickSchoolNotice({ what }: { what: string }) {
  return (
    <section className="admin-panel admin-notice">
      <h2>Pick a school</h2>
      <p>{what} are set per school. Choose one in the School picker at the top right.</p>
    </section>
  );
}
