import { DownloadIcon, Trash2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEndSession } from '@/features/auth/useEndSession'
import { useDeleteAccount, useExportData } from '@/features/me/api'
import { useErrorMessage } from '@/shared/api/useErrorMessage'

/** Anchor of this card, linked from the consent revoke dialog. */
export const DATA_RIGHTS_ID = 'your-data'

/** Where Auth0 returns after the account is deleted (must be an Allowed Logout URL). */
export const ACCOUNT_DELETED_PATH = '/login?deleted=1'

function normalize(word: string): string {
  return word.trim().toLocaleUpperCase()
}

/** "Your data": export (GET /me/export) and account deletion (DELETE /me), backend ADR 0006. */
export function DataRightsCard() {
  const { t } = useTranslation()
  const exportData = useExportData()
  const errorMessage = useErrorMessage()

  return (
    <Card id={DATA_RIGHTS_ID} tabIndex={-1} className="scroll-mt-4 outline-none">
      <CardHeader>
        <CardTitle>{t('settings.data.title')}</CardTitle>
        <CardDescription>{t('settings.data.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={exportData.isPending}
          onClick={() => {
            exportData.mutate(undefined, {
              onError: (error) => toast.error(errorMessage(error)),
            })
          }}
        >
          <DownloadIcon aria-hidden />
          {exportData.isPending ? t('settings.data.downloading') : t('settings.data.download')}
        </Button>
        <DeleteAccountDialog />
      </CardContent>
    </Card>
  )
}

function DeleteAccountDialog() {
  const { t } = useTranslation()
  const deleteAccount = useDeleteAccount()
  const endSession = useEndSession()
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const inputId = useId()

  const word = t('settings.data.confirmWord')
  const matches = normalize(typed) === normalize(word)
  const busy = deleteAccount.isPending || deleteAccount.isSuccess

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
        if (!next) setTyped('')
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2Icon aria-hidden />
          {t('settings.data.delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('settings.data.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{t('settings.data.deleteWhat')}</p>
              <p className="font-medium text-foreground">{t('settings.data.deleteIrreversible')}</p>
              <p>{t('settings.data.deleteExportFirst')}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id={`${inputId}-form`}
          className="min-w-0 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!matches || busy) return
            deleteAccount.mutate(undefined, {
              onSuccess: () => void endSession(ACCOUNT_DELETED_PATH),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }}
        >
          <Label htmlFor={inputId} className="block leading-normal">
            {t('settings.data.confirmLabel', { word })}
          </Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value)
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={busy}
          />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('settings.cancel')}</AlertDialogCancel>
          <Button
            type="submit"
            form={`${inputId}-form`}
            variant="destructive"
            disabled={!matches || busy}
          >
            {t('settings.data.deleteConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
