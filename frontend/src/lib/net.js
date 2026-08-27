// Network connectivity helper for openGym.
//
// Single source of truth for online/offline detection and reconnection events across Web and Capacitor.
// Designed to fail open: unknown/ambiguous network state is treated as online so operations are attempted.
// Never exposes or returns raw Capacitor Plugin Proxy objects to avoid the "Network.then() is not implemented" trap.

export async function isOnline(options = {}) {
  if (options.network) {
    try {
      const status = await options.network.getStatus()
      return status?.connected !== false
    } catch {
      return true
    }
  }

  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Network } = await import('@capacitor/network')
      const status = await Network.getStatus()
      return status?.connected !== false
    } catch {
      return true
    }
  }

  return typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true
}

export function onReconnect(callback, options = {}) {
  if (typeof callback !== 'function') return () => {}

  let unsubscribed = false
  let lastWasOffline = false

  // Seed initial offline state so if the app booted while offline,
  // the first transition to online will correctly trigger the callback.
  isOnline(options).then((online) => {
    if (!unsubscribed && !online) {
      lastWasOffline = true
    }
  }).catch(() => {})

  const handleStatusChange = (connected) => {
    if (unsubscribed) return
    if (connected && lastWasOffline) {
      lastWasOffline = false
      try {
        callback()
      } catch {
        // Ignore listener error
      }
    } else if (!connected) {
      lastWasOffline = true
    }
  }

  // Native Capacitor platform
  if (options.network) {
    let handle = null
    options.network
      .addListener('networkStatusChange', (status) => {
        handleStatusChange(status?.connected !== false)
      })
      .then((h) => {
        if (unsubscribed) {
          h?.remove?.()
        } else {
          handle = h
        }
      })
      .catch(() => {})

    return () => {
      unsubscribed = true
      if (handle?.remove) {
        handle.remove()
      }
    }
  }

  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    let handle = null
    import('@capacitor/network')
      .then(({ Network }) => {
        if (unsubscribed) return null
        return Network.addListener('networkStatusChange', (status) => {
          handleStatusChange(status?.connected !== false)
        })
      })
      .then((h) => {
        if (unsubscribed) {
          h?.remove?.()
        } else {
          handle = h
        }
      })
      .catch(() => {})

    return () => {
      unsubscribed = true
      if (handle?.remove) {
        handle.remove()
      }
    }
  }

  // Web Browser environment
  if (typeof window !== 'undefined') {
    const handleOnline = () => handleStatusChange(true)
    const handleOffline = () => handleStatusChange(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribed = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  return () => {
    unsubscribed = true
  }
}
