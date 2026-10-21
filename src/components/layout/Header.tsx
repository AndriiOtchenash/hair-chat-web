import { useAuth0 } from '@auth0/auth0-react'
import { LogOutIcon, MenuIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { LanguageRadioItems, LanguageSwitcher } from './LanguageSwitcher'

const NAV = [
  { to: '/chat', key: 'nav.chat' },
  { to: '/settings', key: 'nav.settings' },
] as const

function useSignOut() {
  const { logout } = useAuth0()
  return () => void logout({ logoutParams: { returnTo: window.location.origin } })
}

export function Header() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth0()

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
        <span className="font-semibold whitespace-nowrap">{t('app.title')}</span>
        {isAuthenticated ? (
          <>
            <DesktopNav />
            <MobileMenu />
          </>
        ) : (
          <LanguageSwitcher />
        )}
      </div>
    </header>
  )
}

/** sm and wider: links, language and sign-out in a row. */
function DesktopNav() {
  const { t } = useTranslation()
  const signOut = useSignOut()
  return (
    <div className="hidden flex-1 items-center justify-between gap-2 sm:flex">
      <nav className="flex items-center gap-1">
        {NAV.map(({ to, key }) => (
          <Button key={to} variant="ghost" size="sm" asChild>
            <NavLink to={to} className="aria-[current=page]:bg-accent">
              {t(key)}
            </NavLink>
          </Button>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOutIcon aria-hidden />
          {t('auth.signOut')}
        </Button>
      </div>
    </div>
  )
}

/** Below sm: the same items behind a burger button. */
function MobileMenu() {
  const { t } = useTranslation()
  const signOut = useSignOut()
  return (
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('nav.menu')}>
            <MenuIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {NAV.map(({ to, key }) => (
            <DropdownMenuItem key={to} asChild>
              <NavLink to={to} className="aria-[current=page]:font-semibold">
                {t(key)}
              </NavLink>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
          <LanguageRadioItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOutIcon aria-hidden />
            {t('auth.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
