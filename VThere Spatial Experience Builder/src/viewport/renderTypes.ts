export interface EnvStatus {
  state: 'loading' | 'ready' | 'error'
  progress: number
  message?: string
}
