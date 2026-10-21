import { MessageCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AiDisclosure } from '@/components/AiDisclosure'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Placeholder until the chat (1.11); already behind RequireConsents. */
export function ChatPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <AiDisclosure />
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{t('chat.title')}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <MessageCircleIcon aria-hidden className="size-5" />
          {t('chat.comingSoon')}
        </CardContent>
      </Card>
    </div>
  )
}
