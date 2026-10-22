import type { TFunction } from 'i18next'

import { getConsentTexts } from '@/consents'
import { Markdown } from '@/features/chat/Markdown'
import { LANGUAGE_NAMES, type Language } from '@/i18n'
import type { AccountExport } from '@/shared/api/types'

type Conversation = AccountExport['conversations'][number]

/** Body of the readable export (see exportHtml.ts). Data is rendered only as React text. */
export function ExportDocument({
  data,
  t,
  language,
}: {
  data: AccountExport
  t: TFunction
  language: Language
}) {
  const dateTime = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' })
  const fmt = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—')
  const consentTitles = getConsentTexts(language)
  const { user } = data
  const byTime = <T extends { created_at: string }>(items: T[]) =>
    [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const conversations = [...data.conversations].sort((a, b) =>
    a.last_message_at.localeCompare(b.last_message_at),
  )

  return (
    <main>
      <h1>{t('export.title')}</h1>
      <p className="muted">{t('export.exportedAt', { date: fmt(data.exported_at) })}</p>

      <section>
        <h2>{t('export.profile')}</h2>
        <dl>
          <dt>{t('export.fields.id')}</dt>
          <dd>{user.id}</dd>
          <dt>{t('export.fields.signInId')}</dt>
          <dd>{user.auth_sub}</dd>
          <dt>{t('export.fields.email')}</dt>
          <dd>{user.email ?? '—'}</dd>
          <dt>{t('export.fields.name')}</dt>
          <dd>{user.display_name ?? '—'}</dd>
          <dt>{t('export.fields.language')}</dt>
          <dd>{LANGUAGE_NAMES[user.locale]}</dd>
          <dt>{t('export.fields.role')}</dt>
          <dd>{t(`me.roles.${user.role}`)}</dd>
          <dt>{t('export.fields.createdAt')}</dt>
          <dd>{fmt(user.created_at)}</dd>
          <dt>{t('export.fields.ageConfirmedAt')}</dt>
          <dd>{fmt(user.age_confirmed_at)}</dd>
        </dl>
      </section>

      <section>
        <h2>{t('export.consents')}</h2>
        {data.consents.length === 0 ? (
          <p className="muted">{t('export.none')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('export.consentType')}</th>
                  <th>{t('export.consentVersion')}</th>
                  <th>{t('export.grantedAt')}</th>
                  <th>{t('export.revokedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.consents]
                  .sort((a, b) => a.granted_at.localeCompare(b.granted_at))
                  .map((consent) => (
                    <tr key={`${consent.type}-${consent.version}-${consent.granted_at}`}>
                      <td>{consentTitles[consent.type].title}</td>
                      <td className="nowrap">{consent.version}</td>
                      <td>{fmt(consent.granted_at)}</td>
                      <td>{fmt(consent.revoked_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>{t('export.conversations', { total: conversations.length })}</h2>
        {conversations.length === 0 && <p className="muted">{t('export.none')}</p>}
        {conversations.map((conversation) => (
          <ConversationBlock
            key={conversation.id}
            conversation={conversation}
            t={t}
            fmt={fmt}
            messages={byTime(conversation.messages)}
          />
        ))}
      </section>
    </main>
  )
}

function ConversationBlock({
  conversation,
  messages,
  t,
  fmt,
}: {
  conversation: Conversation
  messages: Conversation['messages']
  t: TFunction
  fmt: (iso: string | null) => string
}) {
  return (
    <article className="conversation">
      <h3>{conversation.title ?? t('chat.untitled')}</h3>
      <p className="muted">
        {t('export.conversationDates', {
          created: fmt(conversation.created_at),
          last: fmt(conversation.last_message_at),
        })}
      </p>
      {conversation.summary && (
        <div className="summary">
          <strong>{t('export.summary')}: </strong>
          <span className="plain">{conversation.summary}</span>
        </div>
      )}
      {messages.map((message) => (
        <div key={message.id} className={`message ${message.role}`}>
          <header>
            {message.role === 'user' ? t('chat.you') : t('chat.assistant')}
            <time dateTime={message.created_at}>{fmt(message.created_at)}</time>
          </header>
          {message.role === 'assistant' ? (
            <div className="content">
              <Markdown>{message.content}</Markdown>
            </div>
          ) : (
            <div className="content plain">{message.content}</div>
          )}
        </div>
      ))}
    </article>
  )
}
