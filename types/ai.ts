export interface StreamTextOptions {
  onFinish?: (result: {
    content: string
    reasoning?: string
  }) => Promise<void> | void
  abortSignal?: AbortSignal
}

export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
  steps?: number
  images?: (Blob | Buffer | File | string)[]
  guidance?: number
  seed?: number
}

export interface GenerateImageResult {
  success: boolean
  path?: string
  error?: string
  prompt: string
  width?: number
  height?: number
  model: string
}

export interface GenerateAudioOptions {
  text: string
  voice?: string
}

export interface GenerateAudioResult {
  success: boolean
  buffer?: Buffer
  error?: string
  text: string
}
