import { assign, createMachine, type SnapshotFrom } from 'xstate';

export const CaptureState = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
} as const;

export type CaptureStateValue = (typeof CaptureState)[keyof typeof CaptureState];

type CaptureEvent =
  | { type: 'START_RECORDING'; url?: string; guideId?: string }
  | { type: 'STOP_RECORDING' }
  | { type: 'USER_ACTION' }
  | { type: 'URL_CHANGED'; url: string };

interface CaptureContext {
  currentGuideId: string | null;
  stepCount: number;
  currentUrl: string;
}

export const captureMachine = createMachine({
  id: 'capture',
  initial: CaptureState.IDLE,
  types: {} as {
    context: CaptureContext;
    events: CaptureEvent;
  },
  context: {
    currentGuideId: null,
    stepCount: 0,
    currentUrl: '',
  },
  states: {
    [CaptureState.IDLE]: {
      on: {
        START_RECORDING: {
          target: CaptureState.RECORDING,
          actions: assign({
            currentGuideId: ({ event }) => event.guideId ?? crypto.randomUUID(),
            stepCount: 0,
            currentUrl: ({ event }) => event.url ?? '',
          }),
        },
      },
    },
    [CaptureState.RECORDING]: {
      on: {
        STOP_RECORDING: {
          target: CaptureState.IDLE,
          actions: assign({
            currentGuideId: null,
            stepCount: 0,
            currentUrl: '',
          }),
        },
        USER_ACTION: {
          actions: assign({
            stepCount: ({ context }) => context.stepCount + 1,
          }),
        },
        URL_CHANGED: {
          actions: assign({
            currentUrl: ({ event }) => event.url,
          }),
        },
      },
    },
  },
});

export type CaptureSnapshot = SnapshotFrom<typeof captureMachine>;
