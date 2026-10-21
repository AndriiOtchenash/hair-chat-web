import { useAuth0 } from '@auth0/auth0-react'
import { LogOutIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { Button } from '@/components/ui/button'

import { LanguageSwitcher } from './LanguageSwitcher'

export function Header() {
  const { t } = useTranslation()
  const { isAuthenticated, logout } = useAuth0()

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-1">
          <span className="mr-3 font-semibold">{t('app.title')}</span>
          {isAuthenticated && (
            <>
              <HeaderLink to="/chat">{t('nav.chat')}</HeaderLink>
              <HeaderLink to="/settings">{t('nav.settings')}</HeaderLink>
            </>
          )}
        </nav>
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

function HeaderLink({ to, children }: { to: string; children: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <NavLink to={to} className="aria-[current=page]:bg-accent">
        {children}
      </NavLink>
    </Button>
  )
}
