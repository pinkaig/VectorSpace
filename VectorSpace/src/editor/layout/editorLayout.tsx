/**
 * @file        editorLayout.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Page layout for the editor. Places the top bar, 3D view,
 *              floating corner spots, catalogue and right panel using
 *              named slots. Holds no editor logic; EditorPage decides
 *              what goes into each slot and which optional slots show.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { ReactNode } from "react";
import './editorLayout.css'

type editorLayoutProps =  {
    topBar: ReactNode;
    viewport: ReactNode; // required
    cornerTopLeft?: ReactNode; // optional
    cornerTopRight?: ReactNode; // optional
    cornerBottomLeft?: ReactNode; // optional
    cornerBottomRight?: ReactNode; // optional
    catalogue?: ReactNode; // optional
    rightPanel?: ReactNode; // optional
}

export function EditorLayout({
    topBar,
    viewport,
    cornerTopLeft,
    cornerTopRight,
    cornerBottomLeft,
    cornerBottomRight,
    catalogue,
    rightPanel,
}: editorLayoutProps) {
    const rootClass = [
        "editor-layout",
        rightPanel && "editor-layout--with-panel",
        catalogue && "editor-layout--with-catalogue",
    ]
    .filter(Boolean)
    .join(" ");

    return (
        <div className={rootClass}>
            <header className="editor-layout-topbar">{topBar}</header>

            <main className="editor-layout-stage">
                <div className="editor-layout-viewport">{viewport}</div>

                {cornerTopLeft && (
                    <div className="editor-layout-corner editor-layout-corner--tl">{cornerTopLeft}</div>
                )}
                {cornerTopRight && (
                    <div className="editor-layout-corner editor-layout-corner--tr">{cornerTopRight}</div>
                )}
                {cornerBottomLeft && (
                    <div className="editor-layout-corner editor-layout-corner--bl">{cornerBottomLeft}</div>
                )}
                {cornerBottomRight && (
                    <div className="editor-layout-corner editor-layout-corner--br">{cornerBottomRight}</div>
                )}
            </main>

            {rightPanel && <aside className="editor-layout-panel">{rightPanel}</aside>}
            {catalogue && <aside className="editor-layout-catalogue">{catalogue}</aside>}
        </div>
    )    
}