/** TanStack Query keys shared across features (and the global consent_required handler). */
export const queryKeys = {
  me: ['me'] as const,
  consents: ['consents'] as const,
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  /** Sources/truncated of answers streamed in this session (GET messages does not return them). */
  answerMeta: ['answerMeta'] as const,
}
