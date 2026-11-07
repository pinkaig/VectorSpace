/**
 * @file        AdminPageTitle.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The top of every admin page, as in the designer's prototype: the page name, one
 *              plain sentence under it saying what the page is for, and on the right which school
 *              the page is showing.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

type AdminPageTitleProps = { title: string; subtitle: string; scope: string };

export function AdminPageTitle({ title, subtitle, scope }: AdminPageTitleProps) {
  return (
    <div className="admin-page-title">
      <div>
        <h1>{title}</h1>
        <p className="admin-page-sub">{subtitle}</p>
      </div>
      <p className="admin-page-scope">{scope}</p>
    </div>
  );
}
