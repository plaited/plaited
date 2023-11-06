/* eslint-disable prefer-destructuring */
import type { Addon_ClientStoryApi, Addon_Loadable } from '@storybook/types';
import { start } from '@storybook/preview-api';

import { renderToCanvas } from './render.js';
import type { PlaitedRender } from './types.js';

export interface ClientApi extends Addon_ClientStoryApi<PlaitedRender['storyResult']> {
  configure(loader: Addon_Loadable, module: NodeModule): void;
  forceReRender(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: () => any; // todo add type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: (...args: any[]) => void;
}

const RENDERER = 'plaited';
const api = start<PlaitedRender>(renderToCanvas);

export const storiesOf: ClientApi['storiesOf'] = (kind, m) => {
  return (api.clientApi.storiesOf(kind, m) as ReturnType<ClientApi['storiesOf']>).addParameters({
    renderer: RENDERER,
  });
};

export const configure: ClientApi['configure'] = (...args) => api.configure(RENDERER, ...args);
export const forceReRender: ClientApi['forceReRender'] = api.forceReRender;
export const raw: ClientApi['raw'] = api.clientApi.raw;
