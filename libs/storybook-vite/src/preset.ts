import type { PresetProperty } from '@storybook/types';
import path from 'path';
import type { StorybookConfig } from './types.js';

const getAbsolutePath = <I extends string>(input: I): I =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  path.dirname(require.resolve(path.join(input, 'package.json'))) as any;

export const core: PresetProperty<'core', StorybookConfig> = {
  builder: getAbsolutePath('@storybook/builder-vite'),
  renderer: getAbsolutePath('@plaited/storybook'),
};
