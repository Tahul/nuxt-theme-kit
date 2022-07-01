import type { Core as Instance } from 'browser-style-dictionary/types/browser'
import StyleDictionary from 'browser-style-dictionary/browser.js'
import type { NuxtThemeTokens } from '../../index'
import { objectPaths } from '../../utils'

const DesignTokenType =
`interface DesignToken {
  /* The raw value you specified in your token declaration. */
  value: any;
  /* CSS Variable reference that gets generated. */
  variable: string;
  name?: string;
  comment?: string;
  themeable?: boolean;
  attributes?: {
    category?: string;
    type?: string;
    item?: string;
    subitem?: string;
    state?: string;
    [key: string]: any;
  };
  [key: string]: any;
}`

const DesignTokensType =
`interface DesignTokens {
  [key: string]: DesignTokens | DesignToken;
}`

const treeWalker = (obj, typing: boolean = true) => {
  let type = Object.create(null)

  const has = Object.prototype.hasOwnProperty.bind(obj)

  if (has('value')) {
    // Transform name to CSS variable name
    obj.variable = `var(--${obj.name})`

    // Toggle between type declaration and value
    type = typing ? 'DesignToken' : obj
  } else {
    for (const k in obj) {
      if (has(k)) {
        switch (typeof obj[k]) {
          case 'object':
            type[k] = treeWalker(obj[k], typing)
        }
      }
    }
  }

  return type
}

export const generateTokens = async (
  tokens: NuxtThemeTokens,
  buildPath: string,
  silent = true
) => {
  let styleDictionary: Instance = StyleDictionary

  styleDictionary.fileHeader = {}

  styleDictionary.registerTransformGroup({
    name: 'tokens-js',
    transforms: ['name/cti/kebab', 'size/px', 'color/hex']
  })

  styleDictionary.registerFormat({
    name: 'typescript/css-variables-declaration',
    formatter ({ dictionary }) {
      const tokensObject = treeWalker(dictionary.tokens)

      let result = 'import type { Ref } from \'vue\'\n\n'

      result = result + `export ${DesignTokensType}\n\n`

      result = result + `export ${DesignTokenType}\n\n`

      result = result + `export interface ThemeTokens extends DesignTokens ${JSON.stringify(tokensObject, null, 2)}\n\n`

      const tokensPaths = objectPaths(tokensObject)

      result = result + `export type TokensPaths = ${tokensPaths.map(path => (`'${path}'`)).join(' | \n')}\n\n`

      result = result.replace(/"DesignToken"/g, 'DesignToken')

      return result
    }
  })

  styleDictionary.registerFormat({
    name: 'typescript/css-variables',
    formatter ({ dictionary }) {
      let result = 'import get from \'lodash.get\'\n\n'

      result = result + 'import type { ThemeTokens, TokensPaths, DesignToken } from \'./tokens-types.d\'\n\n'

      result = result + 'export * from \'./tokens-types.d\'\n\n'

      result = result + `export const themeTokens: ThemeTokens = ${JSON.stringify(treeWalker(dictionary.tokens, false), null, 2)}\n`

      result = result + `\n
/**
 * Get a theme token by its path
 */
export const $tokens = (path: TokensPaths, key: keyof DesignToken = 'variable', flatten: boolean = true) => {
  const token = get(themeTokens, path)

  if (key && token?.[key]) { return token[key] }

  if (key && flatten && typeof token === 'object') {
    const flattened = {}
    
    const flatten = (obj) => {
      Object.entries(obj).forEach(([objectKey, value]) => {
        if (value[key]) {
          flattened[objectKey] = value[key]
          return
        }

        flatten(value)
      })
    }

    flatten(token)

    return flattened
  }

  return token
}\n\n`

      result = result + 'export const $dt = $tokens\n\n'

      return result
    }
  })

  styleDictionary.registerFormat({
    name: 'javascript/css-variables',
    formatter ({ dictionary }) {
      let result = 'import get from \'lodash.get\'\n\n'

      result = result + `export const themeTokens = ${JSON.stringify(treeWalker(dictionary.tokens, false), null, 2)}\n`

      result = result +
`\n
/**
 * Get a theme token by its path
 * @typedef {import('tokens-types').TokenPaths} TokenPaths
 * @typedef {import('tokens-types').DesignToken} DesignToken
 * @param {TokenPaths} path The path to the theme token
 * @param {keyof DesignToken} variable Returns the variable if exists if true
 * @param {boolean} flatten If the path gives an object, returns a deeply flattened object with "key" used as values.
 */
export const $tokens = (path, key = 'variable', flatten: boolean = true) => {
  const token = get(themeTokens, path)

  if (key && token?.[key]) { return token[key] }

  if (key && flatten && typeof token === 'object') {
    const flattened = {}
    
    const flatten = (obj) => {
      Object.entries(obj).forEach(([objectKey, value]) => {
        if (value[key]) {
          flattened[objectKey] = value[key]
          return
        }

        flatten(value)
      })
    }

    flatten(token)

    return flattened
  }

  return token
}\n\n`

      result = result + 'export const $to = $tokens\n\n'

      return result
    }
  })

  styleDictionary = await styleDictionary.extend({
    tokens,
    platforms: {
      scss: {
        transformGroup: 'tokens-js',
        buildPath,
        files: [
          {
            destination: '_variables.scss',
            format: 'scss/variables'
          }
        ]
      },

      json: {
        transformGroup: 'tokens-js',
        buildPath,
        files: [
          {
            destination: 'tokens.json',
            format: 'json/flat'
          }
        ]
      },

      ts: {
        transformGroup: 'tokens-js',
        buildPath,
        files: [
          {
            destination: 'tokens.ts',
            format: 'typescript/css-variables'
          },
          {
            destination: 'tokens-types.d.ts',
            format: 'typescript/css-variables-declaration'
          }
        ]
      },

      js: {
        transformGroup: 'tokens-js',
        buildPath,
        files: [
          {
            destination: 'tokens.js',
            format: 'javascript/css-variables'
          }
        ]
      },

      css: {
        transformGroup: 'tokens-js',
        buildPath,
        files: [
          {
            destination: 'variables.css',
            format: 'css/variables'
          }
        ]
      }
    }
  })

  // Weird trick to disable nasty logging
  if (silent) {
    // @ts-ignore
    // eslint-disable-next-line no-console
    console._log = console.log
    // eslint-disable-next-line no-console
    console.log = () => {}
  }

  styleDictionary.cleanAllPlatforms()

  await new Promise(resolve => setTimeout(resolve, 10))

  styleDictionary.buildAllPlatforms()

  await new Promise(resolve => setTimeout(resolve, 10))

  // Weird trick to disable nasty logging
  if (silent) {
    // @ts-ignore
    // eslint-disable-next-line no-console
    console.log = console._log
  }
}
