import { useAuth0 } from '@auth0/auth0-react'
import { LogOutIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { LanguageSwitcher } from './LanguageSwitcher'

export function Header() {
  const { t } = useTranslation()
  const { isAuthenticated, logout } = useAuth0()

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
        <span className="font-semibold">{t('app.title')}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              <LogOutIcon aria-hidden />
              {t('auth.signOut')}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
