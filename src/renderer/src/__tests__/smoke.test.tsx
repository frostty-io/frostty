import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../components/EmptyState'

describe('Smoke tests', () => {
  it('renders EmptyState component', () => {
    render(<EmptyState />)
    expect(screen.getByText('Command Palette')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })
})
