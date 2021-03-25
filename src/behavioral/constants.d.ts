export declare const selectionStrategies: {
    readonly chaos: "chaos";
    readonly random: "randomizedPriority";
    readonly priority: "priority";
};
export declare const baseDynamics: {
    readonly objectObject: "object-object";
    readonly objectPerson: "object-person";
    readonly personPerson: "person-person";
};
export declare const streamEvents: {
    readonly trigger: "triggerEvent";
    readonly select: "selectEvent";
    readonly state: "stateSnapshot";
    readonly assert: "assertEvent";
};
export declare const idioms: {
    readonly waitFor: "waitFor";
    readonly request: "request";
    readonly block: "block";
};
