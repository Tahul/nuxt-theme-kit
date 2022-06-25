import { defineEventHandler } from 'h3'
import { generateTokens } from '../../../../tokens/generate'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async () => {
  const runtimeConfig = useRuntimeConfig()

  const { tokensDir } = runtimeConfig?.public

  const { tokens } = runtimeConfig?.public?.theme

  await generateTokens(tokens, tokensDir)
})
