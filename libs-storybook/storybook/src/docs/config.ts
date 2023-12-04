import {SourceType} from '@storybook/docs-tools';
import {sourceDecorator} from './jsx-decorator.js';
export const parameters = {
  docs: {
    story: { inline: true },
    // source: {
    //   type: SourceType.DYNAMIC
    // },
  },
}

export const decorators = [sourceDecorator];
