/**
 * @file        TextPanelHost.tsx
 * @brief       Renders the text store's open overlay panels as accessible DOM.
 *
 * @responsibility
 * The only place a TextNode tree becomes React elements. Subscribes to
 * TextSystem.store and renders every open `panel`-mode entry as a
 * role="dialog" card: labelled heading, visible keyboard-reachable close
 * control, focus moved in on open and returned on close, Escape closing the
 * focused panel (consumed there so it never doubles as exit-simulation or
 * clear-selection), lang set on the container, links opening in a new tab
 * with rel="noopener noreferrer". No HTML ever: text renders as React children,
 * so author content cannot become markup. An error panel shows
 * "Content unavailable"; an empty text renders nothing rather than an
 * empty panel.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Text-System sections 4, 12 and 14
 * Links point at the project wiki; migration is still in progress.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { InlineNode, PanelStatus, TextNode, TextSnapshot, TextSystem } from '../packages/text/src/index'

const renderInline = (nodes: InlineNode[], keyPrefix: string): ReactNode[] =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>
      case 'strong':
        return <strong key={key}>{renderInline(node.children, key)}</strong>
      case 'emphasis':
        return <em key={key}>{renderInline(node.children, key)}</em>
      case 'code':
        return <code key={key}>{node.value}</code>
      case 'break':
        return <br key={key} />
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">
            {renderInline(node.children, key)}
          </a>
        )
    }
  })

const renderBlock = (node: TextNode, index: number): ReactNode => {
  const key = `block-${index}`
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{renderInline(node.children, key)}</p>
    case 'heading': {
      // the panel title is the dialog's h2, so content headings start at h3
      const Tag = `h${node.level + 2}` as 'h3' | 'h4' | 'h5'
      return <Tag key={key}>{renderInline(node.children, key)}</Tag>
    }
    case 'list': {
      const items = node.items.map((item, itemIndex) => (
        <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
      ))
      return node.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>
    }
  }
}

function PanelDialog({ panel, nodes, modal, onClose }: {
  panel: PanelStatus
  nodes: TextNode[] | undefined
  modal: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // move focus in on open, hand it back to wherever it was on close
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [])
  const headingId = `${panel.id}-title`
  return (
    <div
      ref={dialogRef}
      className={modal ? 'text-panel modal' : 'text-panel'}
      role="dialog"
      aria-modal={modal || undefined}
      aria-labelledby={panel.title ? headingId : undefined}
      aria-label={panel.title ? undefined : 'Information panel'}
      lang={panel.lang}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // the focused panel consumes Escape, so it never doubles as
        // "exit simulation" (RuntimeView) or "clear selection" (editor)
        event.stopPropagation()
        onClose()
      }}
    >
      <header className="text-panel-header">
        {panel.title && <h2 id={headingId}>{panel.title}</h2>}
        <button type="button" className="text-panel-close" onClick={onClose} aria-label="Close panel">×</button>
      </header>
      <div className="text-panel-body">
        {panel.state === 'error' ? <p className="text-panel-error">Content unavailable</p> : nodes?.map(renderBlock)}
      </div>
    </div>
  )
}

export default function TextPanelHost({ text }: { text: TextSystem }) {
  const [snapshot, setSnapshot] = useState<TextSnapshot>(() => text.store.getSnapshot())
  useEffect(() => text.store.subscribe(setSnapshot), [text])

  const overlayPanels = snapshot.panels.filter((panel) => {
    if (panel.mode !== 'panel') return false
    // an empty text renders nothing rather than an empty panel
    if (panel.state !== 'error' && !panel.title && (text.getNodes(panel.id)?.length ?? 0) === 0) return false
    return true
  })

  if (overlayPanels.length === 0) return null
  return (
    <div className="text-panel-layer">
      {snapshot.modalOpen && <div className="text-panel-backdrop" />}
      {overlayPanels.map((panel) => (
        <PanelDialog
          key={panel.id}
          panel={panel}
          nodes={text.getNodes(panel.id)}
          modal={snapshot.modalOpen && panel.id === snapshot.topPanelId}
          onClose={() => text.close({ panelId: panel.id })}
        />
      ))}
    </div>
  )
}
