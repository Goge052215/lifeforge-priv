import type { StorybookConfig } from '@storybook/react-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    'storybook-addon-deep-controls'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  typescript: {
    reactDocgen:
      process.env.NODE_ENV === 'production'
        ? 'react-docgen-typescript'
        : 'react-docgen',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      tsconfigPath: '../tsconfig.json',
      include: ['./src/**/*.tsx']
    },
    check: false,
    skipCompiler: true
  },
  viteFinal: async config => {
    config.plugins = [...(config.plugins ?? []), tsconfigPaths()]
    return {
      ...config
    }
  }
}

export default config
