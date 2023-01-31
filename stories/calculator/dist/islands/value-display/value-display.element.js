/* eslint-disable no-console */
import { strand, loop, waitFor, request, usePlait, useStore, defineElement, } from '@plaited/island';
import { connect } from '../comms.js';
defineElement('value-display', base => class extends base {
    plait($, context) {
        const [getDisplay, setDisplay] = useStore([]);
        const strands = {
            onClear: loop(strand(waitFor({ eventName: 'clear' }), request({ eventName: 'clearDisplay' }))),
            ...[...Array(10).keys()].reduce((acc, cur) => {
                Object.assign(acc, {
                    [`onClick:${cur}`]: loop(strand(waitFor({ eventName: `addNumber-${cur}` }), request({ eventName: 'updateNumber', payload: cur }))),
                });
                return acc;
            }, {}),
            onLog: loop(strand(waitFor({ eventName: 'logMe' }), request({ eventName: 'logSelf' }))),
        };
        const updateDisplay = (target, arr) => {
            target.replaceChildren(`${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`);
        };
        const actions = {
            updateNumber(payload) {
                if (getDisplay.length < 5) {
                    setDisplay([...getDisplay(), payload]);
                }
                const [display] = $('display');
                updateDisplay(display, getDisplay());
            },
            clearDisplay() {
                const [display] = $('display');
                display.replaceChildren('00:00');
                setDisplay([]);
            },
            logSelf() {
                console.log('hit');
            },
        };
        return usePlait({
            context,
            actions,
            strands,
            connect,
        });
    }
});
