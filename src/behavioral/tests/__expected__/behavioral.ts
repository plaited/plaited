export const expectedPriorityStreamLog = [
  {
    baseDynamic: 'object-object',
    eventName: 'Trigger(start)',
    payload: [
      'start',
    ],
    streamEvent: 'triggerEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 0,
        strandName: 'Trigger(start)',
      },
    ],
    requestedEvents: [
      {
        eventName: 'start',
        payload: [
          'start',
        ],
        priority: 0,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'start',
    payload: [
      'start',
    ],
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [],
    streamEvent: 'stateSnapshot',
  },
]
export const expectedRandomizedStreamLog = [
  {
    baseDynamic: 'object-object',
    eventName: 'Trigger(start)',
    payload: [
      'start',
    ],
    streamEvent: 'triggerEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 0,
        strandName: 'Trigger(start)',
      },
    ],
    requestedEvents: [
      {
        eventName: 'start',
        payload: [
          'start',
        ],
        priority: 0,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'start',
    payload: [
      'start',
    ],
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [],
    streamEvent: 'stateSnapshot',
  },
]
export const expectedChaosStreamLog =  [
  {
    baseDynamic: 'object-object',
    eventName: 'Trigger(start)',
    payload: [
      'start',
    ],
    streamEvent: 'triggerEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 0,
        strandName: 'Trigger(start)',
      },
    ],
    requestedEvents: [
      {
        eventName: 'start',
        payload: [
          'start',
        ],
        priority: 0,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'start',
    payload: [
      'start',
    ],
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 1,
        strandName: 'addHot',
      },
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'hot',
        payload: undefined,
        priority: 1,
      },
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'hot',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'hot',
    ],
    logicStrands: [
      {
        priority: 2,
        strandName: 'addCold',
      },
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [
      {
        eventName: 'cold',
        payload: undefined,
        priority: 2,
      },
    ],
    streamEvent: 'stateSnapshot',
  },
  {
    eventName: 'cold',
    payload: undefined,
    streamEvent: 'selectEvent',
  },
  {
    blockedEvents: [
      'cold',
    ],
    logicStrands: [
      {
        priority: 3,
        strandName: 'mixHotCold',
      },
    ],
    requestedEvents: [],
    streamEvent: 'stateSnapshot',
  },
]

export const expectedFeedback = [
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
  'Add hot',
  'Add cold',
]
