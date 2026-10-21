# Consent texts

One folder per version: `src/consents/<version>/{uk,pl,en,ru}.md`. The folder name is the version
string the backend stores (`CONSENT_VERSION` in hair-chat-api, see its docs/consents/README.md),
and `CONSENT_VERSION` in `src/consents/index.ts` points to the current folder.

**Status: DRAFT — legal review required before production.**

## File format

Each file has three sections, one per consent type (`age_18`, `health_data`, `ai_processing`):

```md
<!-- consent:age_18 -->

## Title

Summary: one paragraph, shown next to the checkbox.

Details (any markdown: paragraphs, lists, bold), shown in the "more" dialog together with the summary.
```

HTML comments are not rendered. Raw HTML in the text is not rendered either.

## Changing a text

Changed meaning -> new folder with a new version, never edit a released folder:

1. Copy the folder to `<YYYY-MM-vN>`, edit all four languages.
2. Set `CONSENT_VERSION` in `src/consents/index.ts`; tag the commit `consents-<version>`.
3. Deploy the backend with the same `CONSENT_VERSION`. Users who accepted the old version see
   "Terms have been updated" and accept again.

Tests check that every language has all three sections and that the current folder exists.
