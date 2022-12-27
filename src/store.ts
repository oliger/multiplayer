import { produceWithPatches, applyPatches } from "./helpers/immer";
import { makeMutation, MutateParams, Patch, Room, Template } from "./types";
import { Mutation } from "./types";
import { uuid } from "./helpers/uuid";

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type Intent = { id: string; apply: (template: Template) => Template | void };
type PendingIntent = { intent: Intent; mutation: Mutation };

type ListenerFn = () => void;

type CreateStoreParams = { room: Room };

export const createStore = ({ room }: CreateStoreParams) => {
  let serverState = room.initialState;
  let template = room.initialState.template;
  let pendingIntents: PendingIntent[] = [];

  let undoHistory: string[] = [];
  const undoPatches = new Map<string, Patch[]>();

  let redoHistory: string[] = [];
  const redoPatches = new Map<string, Patch[]>();

  const listeners = new Set<ListenerFn>();

  const subscribe = (fn: ListenerFn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const onChange = () => listeners.forEach((fn) => fn());

  const getState = () => template;

  const mutate = (
    partialIntent: Optional<Intent, "id">,
    shouldAddToHistory = false
  ) => {
    const intent = { ...partialIntent, id: partialIntent.id || uuid() };

    const [nextTemplate, patches, inversePatches] = produceWithPatches(
      template,
      intent.apply
    );

    template = nextTemplate;
    onChange();

    const mutation = makeMutation({ id: intent.id, patches });
    pendingIntents.push({ intent, mutation });
    broadcastPendingIntents();

    if (shouldAddToHistory) {
      undoPatches.set(intent.id, inversePatches);
      undoHistory.push(intent.id);

      redoHistory = [];
      redoPatches.clear();
    }

    return {
      intent,
      mutation,
      inversePatches,
    };
  };

  const receiveMutation = ({ lastMutationId, mutation }: MutateParams) => {
    if (serverState.lastMutationId !== lastMutationId) {
      // TODO: Resync client.
      throw new Error("Client is out of sync.");
    }

    serverState = {
      lastMutationId: mutation.id,
      template: applyPatches(serverState.template, mutation.patches),
    };
    template = serverState.template;

    onChange();

    // Mutations that have not been sent to the server are now outdated and need
    // to be reapplied on top of the updated server state.
    const outdatedIntents = pendingIntents;
    pendingIntents = [];

    for (const { intent } of outdatedIntents) {
      try {
        const { inversePatches } = mutate(intent);

        undoPatches.set(intent.id, inversePatches);
      } catch (err) {
        console.warn("Mutation cannot be reapplied.", intent);

        undoPatches.delete(intent.id);
      }
    }
  };
  room.onMutate(receiveMutation);

  let isBroadcasting = false;
  const broadcastPendingIntents = async () => {
    if (isBroadcasting) return;

    isBroadcasting = true;

    while (true) {
      const pendingIntent = pendingIntents[0];
      if (!pendingIntent) break;

      const isAck = await room.mutate({
        lastMutationId: serverState.lastMutationId,
        mutation: pendingIntent.mutation,
      });

      if (!isAck) {
        break;
      }

      serverState = {
        lastMutationId: pendingIntent.mutation.id,
        template: applyPatches(
          serverState.template,
          pendingIntent.mutation.patches
        ),
      };

      pendingIntents.shift();
    }

    isBroadcasting = false;
  };

  const undo = () => {
    const intentId = undoHistory.pop();
    if (!intentId) return;

    const patches = undoPatches.get(intentId);
    if (!patches) return;

    const { inversePatches } = mutate({
      apply: (draft) => applyPatches(draft, patches),
    });

    redoPatches.set(intentId, inversePatches);
    redoHistory.push(intentId);
  };

  const redo = () => {
    const intentId = redoHistory.pop();
    if (!intentId) return;

    const patches = redoPatches.get(intentId);
    if (!patches) return;

    const { inversePatches } = mutate({
      apply: (draft) => applyPatches(draft, patches),
    });

    undoPatches.set(intentId, inversePatches);
    undoHistory.push(intentId);
  };

  return {
    getState,
    subscribe,
    mutate,
    undo,
    redo,
  };
};
