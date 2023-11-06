import { global } from '@storybook/global';

const { window: globalWindow } = global;


declare global {
  interface Window {
    STORYBOOK_ENV: 'plaited';
  }
}

if (globalWindow) {
  globalWindow.STORYBOOK_ENV = 'plaited';
}
