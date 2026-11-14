export interface RefreshAuthSnapshot<TUser> {
  isAuthenticated: boolean
  refreshToken: string | null
  user: TUser | null
}

export interface RefreshCredentials {
  accessToken: string
  refreshToken: string
}

interface RefreshCoordinatorDependencies<TUser> {
  getAuth: () => RefreshAuthSnapshot<TUser>
  refresh: (refreshToken: string) => Promise<RefreshCredentials>
  setAuth: (credentials: RefreshCredentials, user: TUser) => void
  onFailure: () => void
}

/** Coalesces refresh requests while preventing a stale response from reviving logout. */
export function createRefreshCoordinator<TUser>(
  dependencies: RefreshCoordinatorDependencies<TUser>,
) {
  let inFlight: { refreshToken: string; promise: Promise<string> } | null = null

  return (refreshToken: string): Promise<string> => {
    if (inFlight?.refreshToken === refreshToken) return inFlight.promise

    const auth = dependencies.getAuth()
    if (!auth.isAuthenticated || auth.refreshToken !== refreshToken || !auth.user) {
      return Promise.reject(new Error('Session ended before refresh completed'))
    }

    let promise: Promise<string>
    promise = dependencies.refresh(refreshToken)
      .then((credentials) => {
        const current = dependencies.getAuth()
        if (!current.isAuthenticated || current.refreshToken !== refreshToken || !current.user) {
          throw new Error('Session ended before refresh completed')
        }
        dependencies.setAuth(credentials, current.user)
        return credentials.accessToken
      })
      .catch((error: unknown) => {
        const current = dependencies.getAuth()
        if (current.isAuthenticated && current.refreshToken === refreshToken) {
          dependencies.onFailure()
        }
        throw error
      })
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = null
      })

    inFlight = { refreshToken, promise }
    return promise
  }
}
