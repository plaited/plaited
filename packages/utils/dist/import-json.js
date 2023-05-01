export const importJson = async (filePath) => {
    const { default: obj } = await import(filePath, { assert: { type: 'json' } });
    return obj;
};
