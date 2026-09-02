import { describe, it, expect } from 'vitest'
import { mapAuthError } from './errors.js'

describe('mapAuthError', () => {
  it('maps invalid credentials error correctly', () => {
    const err = { code: 401, type: 'user_invalid_credentials', message: 'Invalid credentials. Please check the email and password.' }
    expect(mapAuthError(err)).toBe('Invalid email or password')
  })

  it('maps user already exists error correctly', () => {
    const err = { code: 409, type: 'user_already_exists', message: 'A user with the same email already exists in your project.' }
    expect(mapAuthError(err, true)).toBe('An account with this email already exists')
  })

  it('maps password requirements error correctly', () => {
    const err = { code: 400, type: 'password_recently_used', message: 'Password must not be in the list of recently used passwords.' }
    expect(mapAuthError(err, true)).toBe('Password must be at least 8 characters')
  })

  it('maps network errors correctly', () => {
    const err = { message: 'Failed to fetch' }
    expect(mapAuthError(err)).toBe('Network error — please check your internet connection')

    const errNetwork = new TypeError('NetworkError when attempting to fetch resource.')
    expect(mapAuthError(errNetwork)).toBe('Network error — please check your internet connection')
  })

  it('maps user limit exceeded error correctly', () => {
    const err = { code: 400, type: 'user_count_exceeded', message: 'The current project has exceeded the maximum number of users.' }
    expect(mapAuthError(err, true)).toBe('The project has reached its user registration limit in Appwrite console')
  })

  it('returns safe fallback without leaking raw backend strings', () => {
    const err = { code: 500, message: 'Internal server error in Appwrite container database at line 140' }
    expect(mapAuthError(err, false)).toBe('Sign-in failed. Please check your credentials.')
    expect(mapAuthError(err, true)).toBe('Registration failed. Please try again.')
  })
})
