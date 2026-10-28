import { EllipsisVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { ConversationOut } from '@/shared/api/types'

import { MAX_TITLE_CHARS } from './api'

/** Marks the rename input, so the mobile panel does not close on its Escape. */
export const RENAME_INPUT_ATTR = 'data-conversation-rename'

/** One row of the conversation list: link, actions menu, and the inline rename field. */
export function ConversationItem({
  conversation,
  date,
  editing,
  onNavigate,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  conversation: ConversationOut
  date: string
  editing: boolean
  onNavigate?: () => void
  onStartRename: () => void
  onRename: (title: string) => void
  onCancelRename: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const title = conversation.title ?? t('chat.untitled')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const renameChosenRef = useRef(false)
  const wasEditingRef = useRef(editing)

  // Back from the rename field: focus goes to this row's menu button, not to the page start.
  useEffect(() => {
    if (wasEditingRef.current && !editing) triggerRef.current?.focus()
    wasEditingRef.current = editing
  }, [editing])

  if (editing) {
    return (
      <RenameField initial={conversation.title ?? ''} onSave={onRename} onCancel={onCancelRename} />
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1 rounded-md hover:bg-accent has-[a[aria-current=page]]:bg-accent">
      <NavLink
        to={`/chat/${conversation.id}`}
        onClick={onNavigate}
        className="block min-w-0 flex-1 rounded-md px-2 py-2"
      >
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{date}</span>
      </NavLink>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t('chat.manage.actions', { title })}
          >
            <EllipsisVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            // The rename field takes the focus; the menu must not hand it back to the trigger.
            if (renameChosenRef.current) event.preventDefault()
            renameChosenRef.current = false
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              renameChosenRef.current = true
              onStartRename()
            }}
          >
            <PencilIcon aria-hidden />
            {t('chat.manage.rename')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2Icon aria-hidden />
            {t('chat.manage.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Enter saves, Escape cancels, leaving the field saves; an empty name is never sent. */
function RenameField({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (title: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial)
  const [empty, setEmpty] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)
  const hintId = useId()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function finish(save: boolean): boolean {
    if (doneRef.current) return true
    const title = value.trim()
    if (save && !title) {
      setEmpty(true)
      return false
    }
    doneRef.current = true
    if (save && title !== initial) onSave(title)
    else onCancel()
    return true
  }

  return (
    <form
      className="min-w-0 px-1 py-1"
      onSubmit={(event) => {
        event.preventDefault()
        finish(true)
      }}
    >
      <Input
        ref={inputRef}
        {...{ [RENAME_INPUT_ATTR]: '' }}
        aria-label={t('chat.manage.renameLabel')}
        aria-invalid={empty || undefined}
        aria-describedby={empty ? hintId : undefined}
        value={value}
        maxLength={MAX_TITLE_CHARS}
        autoComplete="off"
        onChange={(event) => {
          setValue(event.target.value)
          setEmpty(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            finish(false)
          }
        }}
        onBlur={() => {
          if (!finish(true)) finish(false)
        }}
      />
      {empty && (
        <p id={hintId} role="alert" className="mt-1 px-1 text-xs text-destructive">
          {t('chat.manage.renameEmpty')}
        </p>
      )}
    </form>
  )
}
