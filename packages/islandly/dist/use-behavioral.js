import { bProgram } from '@plaited/behavioral';
export const useBehavioral = ({ id, connect, dev, strategy, context, }) => {
    const { trigger, ...rest } = bProgram({
        strategy,
        dev,
    });
    let disconnect;
    if (connect) {
        const tagName = context.tagName.toLowerCase();
        const _id = context.id;
        if (id && !_id) {
            console.error(`island ${tagName} is missing an id attribute and cannot communicate with messenger`);
        }
        disconnect = id && _id ? connect(_id, trigger) : connect(tagName, trigger);
        trigger({
            type: `connected->${id ? _id ?? `${tagName} with missing id` : tagName}`,
        });
    }
    return { trigger, disconnect, ...rest };
};
