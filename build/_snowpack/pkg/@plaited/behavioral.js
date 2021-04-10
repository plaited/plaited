const selectionStrategies = {
    chaos: 'chaos',
    random: 'randomizedPriority',
    priority: 'priority',
};
const baseDynamics = {
    objectObject: 'object-object',
    objectPerson: 'object-person',
    personPerson: 'person-person',
};
const streamEvents = {
    trigger: 'triggerEvent',
    select: 'selectEvent',
    state: 'stateSnapshot',
    assert: 'assertEvent',
};

const requestInParameter = ({ eventName: requestEventName, payload: requestPayload }) => ({ eventName: parameterEventName, callback: parameterCallback }) => (parameterCallback
    ? parameterCallback({ payload: requestPayload, eventName: requestEventName })
    : requestEventName === parameterEventName);

const stateChart = ({ candidates, blocked, pending }) => {
    const strands = [...pending]
        .filter(({ strandName }) => strandName)
        .map(({ strandName }) => strandName);
    const Blocked = [
        ...new Set(blocked.map(({ eventName }) => eventName).filter(Boolean)),
    ];
    const Requests = [
        ...new Set(candidates
            .map(request => ({
            eventName: request.eventName,
            payload: request.payload,
        }))
            .filter(Boolean)),
    ];
    return {
        streamEvent: streamEvents.state,
        logicStrands: [...new Set(strands)],
        requestedEvents: Requests,
        blockedEvents: Blocked,
    };
};

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};
const randomizedPriority = (candidateEvents, blockedEvents) => {
    const filteredEvents = candidateEvents.filter(request => !blockedEvents.some(requestInParameter(request)));
    shuffle(filteredEvents);
    return filteredEvents.sort(({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB)[0];
};
const chaosStrategy = (candidateEvents, blockedEvents) => {
    const randomArrayElement = (arr) => arr[Math.floor(Math.random() * Math.floor(arr.length))];
    return randomArrayElement(candidateEvents.filter(request => !blockedEvents.some(requestInParameter(request))));
};
const priorityStrategy = (candidateEvents, blockedEvents) => {
    return candidateEvents
        .filter(request => !blockedEvents.some(requestInParameter(request)))
        .sort(({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB)[0];
};
const strategies = {
    [selectionStrategies.random]: randomizedPriority,
    [selectionStrategies.priority]: priorityStrategy,
    [selectionStrategies.chaos]: chaosStrategy,
};

const candidatesList = (pending) => pending.reduce((acc, { request, ...rest }) => acc.concat(
// Flatten bids' request arrays
request ? request.map(event => ({ ...rest, ...event })) : []), []);
const blockedList = (pending) => pending.reduce((acc, { block }) => acc.concat(
// Flatten bids' block arrays
block ? block.map(event => event) : []), []);

const bProgram = ({ strategy, stream, debug, }) => {
    const eventSelectionStrategy = typeof strategy === 'string'
        ? strategies[strategy]
        : strategy;
    const pending = new Set();
    const running = new Set();
    let lastEvent = {};
    function run() {
        running.size && step();
    }
    function step() {
        running.forEach(bid => {
            const { logicStrand, priority, strandName } = bid;
            const { value, done } = logicStrand.next();
            !done &&
                pending.add({
                    strandName,
                    priority,
                    logicStrand,
                    ...value,
                });
            running.delete(bid);
        });
        const candidates = candidatesList([...pending]);
        const blocked = blockedList([...pending]);
        lastEvent = eventSelectionStrategy(candidates, blocked);
        debug && stream(stateChart({ candidates, blocked, pending }));
        lastEvent && nextStep();
    }
    function nextStep() {
        pending.forEach(bid => {
            const { request = [], waitFor = [], logicStrand } = bid;
            const waitList = [...request, ...waitFor];
            if (waitList.some(requestInParameter(lastEvent)) && logicStrand) {
                running.add(bid);
                pending.delete(bid);
            }
        });
        const { eventName, payload } = lastEvent;
        stream({
            streamEvent: streamEvents.select,
            eventName,
            payload,
        });
        run();
    }
    const trigger = ({ eventName, payload, baseDynamic, }) => {
        const logicStrand = function* () {
            yield {
                request: [{ eventName, payload }],
                waitFor: [{ eventName: '', callback: () => true }],
            };
        };
        running.add({
            strandName: `Trigger(${eventName})`,
            priority: 0,
            logicStrand: logicStrand(),
        });
        debug && stream({
            streamEvent: streamEvents.trigger,
            baseDynamic,
            eventName: `Trigger(${eventName})`,
            payload,
        });
        run();
    };
    return { running, trigger };
};

const stream = (initial) => {
    const listeners = [];
    function createdStream(value) {
        for (const i in listeners) {
            listeners[i](value);
        }
    }
    createdStream.subscribe = (listener) => {
        const newInitial = initial !== undefined ? listener(initial) : undefined;
        const newStream = stream(newInitial);
        listeners.push((value) => {
            value !== undefined && newStream(listener(value));
        });
        return newStream;
    };
    return createdStream;
};

const delegate = (...gens) => function* () {
    for (const gen of gens) {
        yield* gen();
    }
};
const loop = (...gens) => (callback = () => true) => function* () {
    while (callback()) {
        for (const gen of gens) {
            yield* gen();
        }
    }
};
const strand = (...idiomSets) => function* () {
    for (const set of idiomSets) {
        yield set;
    }
};
const track = (strands, { strategy = selectionStrategies.priority, debug = false } = {}) => {
    const stream$1 = stream();
    const { running, trigger } = bProgram({ stream: stream$1, strategy, debug });
    const feedback = (actions) => stream$1.subscribe(({ streamEvent, ...rest }) => {
        if (streamEvent !== streamEvents.select)
            return;
        const { eventName, payload } = rest;
        actions[eventName] && actions[eventName](payload);
    });
    const add = (logicStands) => {
        for (const strandName in logicStands)
            running.add({
                strandName,
                priority: running.size + 1,
                logicStrand: logicStands[strandName](),
            });
    };
    add(strands);
    return Object.freeze({ trigger, feedback, stream: stream$1, add });
};

const idiom = (key) => (...idioms) => {
    return {
        [key]: [...idioms],
    };
};
const waitFor = idiom('waitFor');
const block = idiom('block');
const request = idiom('request');

export { baseDynamics, block, delegate, loop, request, requestInParameter, selectionStrategies, strand, streamEvents, track, waitFor };
