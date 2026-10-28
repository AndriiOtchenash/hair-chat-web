import { MessagesSquareIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { AiDisclosure } from '@/components/AiDisclosure'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import { RENAME_INPUT_ATTR } from './ConversationItem'
import { ConversationList, NewConversationButton } from './ConversationList'

/** /chat and /chat/:id: conversation list (side column, or a slide-out panel below md) + Outlet. */
export function ChatLayout() {
  const { t } = useTranslation()
  const [panelOpen, setPanelOpen] = useState(false)
  const closePanel = () => {
    setPanelOpen(false)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <h1 className="sr-only">{t('chat.title')}</h1>
      <AiDisclosure />
      <div className="md:hidden">
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <MessagesSquareIcon aria-hidden />
              {t('chat.conversations')}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[85%] max-w-xs gap-0 p-4 pt-12"
            onEscapeKeyDown={(event) => {
              // Escape in the rename field cancels the rename only.
              if (
                event.target instanceof Element &&
                event.target.closest(`[${RENAME_INPUT_ATTR}]`)
              ) {
                event.preventDefault()
              }
            }}
          >
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 size-8"
                aria-label={t('chat.closePanel')}
              >
                <XIcon aria-hidden />
              </Button>
            </SheetClose>
            <SheetHeader className="sr-only">
              <SheetTitle>{t('chat.conversations')}</SheetTitle>
              <SheetDescription>{t('chat.conversationsHint')}</SheetDescription>
            </SheetHeader>
            <ConversationList onNavigate={closePanel} />
          </SheetContent>
        </Sheet>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 gap-4">
        <aside className="hidden w-64 shrink-0 flex-col md:flex">
          <ConversationList />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

/** /chat without a conversation. */
export function ChatHome() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <MessagesSquareIcon aria-hidden className="size-10 text-muted-foreground" />
      <p className="text-muted-foreground">{t('chat.pickOrStart')}</p>
      <NewConversationButton className="w-full max-w-xs" />
    </div>
  )
}
