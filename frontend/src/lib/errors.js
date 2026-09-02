export function mapAuthError(err, isRegister = false) {
  if (!err) return isRegister ? 'Registration failed. Please try again.' : 'Sign-in failed. Please check your credentials.'

  const code = err.code || err.status
  const type = (err.type || '').toLowerCase()
  const msg = (err.message || '').toLowerCase()

  if (
    type === 'user_invalid_credentials' ||
    type === 'user_not_found' ||
    code === 401 ||
    msg.includes('invalid credentials') ||
    msg.includes('user not found')
  ) {
    return 'Invalid email or password'
  }

  if (
    type === 'user_already_exists' ||
    code === 409 ||
    msg.includes('already exists') ||
    msg.includes('duplicate')
  ) {
    return 'An account with this email already exists'
  }

  if (
    type.includes('password') ||
    msg.includes('password must') ||
    msg.includes('password') && code === 400
  ) {
    return 'Password must be at least 8 characters'
  }

  if (
    type === 'user_invalid_email' ||
    type === 'general_argument_invalid' && msg.includes('email') ||
    msg.includes('valid email')
  ) {
    return 'Please enter a valid email address'
  }

  if (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('offline') ||
    msg.includes('connection')
  ) {
    return 'Network error — please check your internet connection'
  }

  return isRegister
    ? 'Registration failed. Please try again.'
    : 'Sign-in failed. Please check your credentials.'
}
