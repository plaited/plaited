export const findByAttribute = (attributeName, attributeValue, context) => {
    const searchInShadowDom = (node) => {
        if (node.nodeType === 1) {
            const attr = node.getAttribute(attributeName);
            if (typeof attributeValue === 'string' &&
                attr === attributeValue) {
                return node;
            }
            if (attributeValue instanceof RegExp &&
                attr &&
                attributeValue.test(attr)) {
                return node ?? undefined;
            }
            if (node.getAttribute(attributeName) === attributeValue) {
                return node;
            }
        }
        if (node.nodeType === 1 && node.shadowRoot) {
            for (const child of node.shadowRoot.children) {
                const result = searchInShadowDom(child);
                if (result) {
                    return result;
                }
            }
        }
        for (const child of node.childNodes) {
            const result = searchInShadowDom(child);
            if (result) {
                return result;
            }
        }
    };
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const rootNode = context ?? document;
            const foundNode = searchInShadowDom(rootNode);
            resolve(foundNode);
        });
    });
};
