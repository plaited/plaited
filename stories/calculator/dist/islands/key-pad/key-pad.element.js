import { usePlait, defineElement } from '@plaited/island';
import { send } from '../comms.js';
// @ts-ignore: test
window.streamLog = [];
defineElement('key-pad', base => class extends base {
    plait() {
        const logger = (msg) => {
            // @ts-ignore: test
            window.streamLog.push(msg);
        };
        const actions = {
            number(evt) {
                const val = evt.currentTarget?.value;
                send('value-display', {
                    eventName: `addNumber-${val}`,
                    payload: val,
                });
            },
            clear() {
                send('value-display', {
                    eventName: 'clear',
                });
            },
        };
        return usePlait({
            actions,
            logger,
        });
    }
});
