import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import { AiDisclosure } from './AiDisclosure'

describe('AiDisclosure', () => {
  it('tells the user they are talking to an AI, in the UI language', async () => {
    await i18n.changeLanguage('ru')
    render(<AiDisclosure />)

    expect(screen.getByRole('note')).toHaveTextContent('Вы общаетесь с ИИ-ассистентом')
  })
})
