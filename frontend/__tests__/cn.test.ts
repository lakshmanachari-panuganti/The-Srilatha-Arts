/**
 * Unit tests for lib/cn.ts
 * Tests the className merging utility (clsx + tailwind-merge).
 */

import { cn } from '../lib/cn'

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles conditional object syntax', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })

  it('handles mixed strings and objects', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('merges conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge: p-4 overrides p-2
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('merges conflicting text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('preserves non-conflicting Tailwind classes', () => {
    const result = cn('flex', 'items-center', 'text-sm')
    expect(result).toContain('flex')
    expect(result).toContain('items-center')
    expect(result).toContain('text-sm')
  })

  it('returns empty string when no truthy classes provided', () => {
    expect(cn(false, undefined, null)).toBe('')
  })

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })
})
