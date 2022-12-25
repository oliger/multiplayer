import create from "zustand";
import {
  produceWithPatches,
  Patch,
  enablePatches,
  applyPatches as immerApplyPatches,
} from "immer";

enablePatches();

type StageState = {
  size: { width: number; height: number };
  color: string;
};

type Operation = { type: "RESIZE"; width: number; height: number };

type HistoryEntry = {
  op: Operation;
  patches: Patch[];
  inversePatches: Patch[];
};

type LogEntry = {
  id: string;
  name?: string;
  patches: Patch[];
};

type LogState = {
  entries: LogEntry[];
};

const initialLogState: LogState = { entries: [] };
const useLogs = create(() => initialLogState);

const initialStageState: StageState = {
  size: { width: 300, height: 400 },
  color: "red",
};
const useStage = create(() => initialStageState);

const applyPatches = (patches: Patch[], name?: string) => {
  useStage.setState((previous) => immerApplyPatches(previous, patches));

  useLogs.setState((previous) => {
    return {
      ...previous,
      entries: [
        { id: crypto.randomUUID(), name, patches },
        ...previous.entries,
      ],
    };
  });
};

let undoEntries: HistoryEntry[] = [];
let redoEntries: HistoryEntry[] = [];

const dispatch = (op: Operation, shouldAddToHistory = false) => {
  const previousState = useStage.getState();
  const [_, patches, inversePatches] = produceWithPatches(
    previousState,
    (draft) => {
      switch (op.type) {
        case "RESIZE": {
          draft.size.width = op.width;
          draft.size.height = op.height;

          draft.color =
            draft.size.width === draft.size.height ? "blue" : draft.color;
        }
      }
    }
  );

  if (!patches.length) return;

  applyPatches(patches, op.type);

  if (shouldAddToHistory) {
    const entry = { op, patches, inversePatches };

    undoEntries.push(entry);
    redoEntries = [];
  }
};

const undo = () => {
  const entry = undoEntries.pop();
  if (!entry) return;

  applyPatches(entry.inversePatches, `UNDO ${entry.op.type}`);
  redoEntries.push(entry);
};

const redo = () => {
  const entry = redoEntries.pop();
  if (!entry) return;

  applyPatches(entry.patches, `REDO ${entry.op.type}`);
  undoEntries.push(entry);
};

// ---

const random = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const colors = ["brown", "aquamarine", "coral", "chartreuse"];

const getRandomPatches = () => {
  const patches: Patch[] = [];

  if (random(0, 1)) {
    patches.push({
      op: "replace",
      path: ["size", "width"],
      value: random(100, 1000),
    });
  }
  if (random(0, 1)) {
    patches.push({
      op: "replace",
      path: ["size", "height"],
      value: random(100, 1000),
    });
  }
  if (random(0, 1)) {
    patches.push({
      op: "replace",
      path: ["color"],
      value: colors[random(0, colors.length - 1)],
    });
  }

  return patches;
};

const applyRandomPatches = () => {
  setTimeout(() => {
    const patches = getRandomPatches();
    if (patches.length) {
      applyPatches(patches, "MULTIPLAYER");
    }

    applyRandomPatches();
  }, random(2000, 10000));
};

applyRandomPatches();

export const App = () => {
  const logsState = useLogs();
  const stageState = useStage();

  return (
    <div className="flex">
      <div className="grow overflow-hidden">
        <div
          style={{
            width: stageState.size.width,
            height: stageState.size.height,
            background: stageState.color,
          }}
        />
      </div>

      <div className="w-96 h-screen overflow-y-auto shrink-0 font-mono text-gray-600 px-4 bg-gray-100 divide-y divide-gray-200 border-l border-l-gray-200">
        <div className="flex py-2 gap-2">
          <button
            className="w-full uppercase text-sm tracking-widest rounded bg-gray-200 p-2 hover:bg-gray-300 transition-colors text-gray-700"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              undo();
            }}
          >
            Undo
          </button>
          <button
            className="w-full uppercase text-sm tracking-widest rounded bg-gray-200 p-2 hover:bg-gray-300 transition-colors text-gray-700"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              redo();
            }}
          >
            Redo
          </button>
        </div>

        <form
          className="py-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();

            dispatch(
              {
                type: "RESIZE",
                width: (e.target as any).width.valueAsNumber,
                height: (e.target as any).height.valueAsNumber,
              },
              true
            );
          }}
        >
          <div className="flex gap-2">
            <input
              className="w-full p-2 appearance-none rounded"
              type="number"
              name="width"
              placeholder="Width"
              required
              min={5}
              max={1000}
            />
            <input
              className="w-full p-2 appearance-none rounded"
              type="number"
              name="height"
              placeholder="Height"
              required
              min={5}
              max={1000}
            />
          </div>

          <button
            className="w-full uppercase text-sm tracking-widest rounded bg-gray-200 p-2 hover:bg-gray-300 transition-colors text-gray-700"
            type="submit"
          >
            Resize
          </button>
        </form>

        <div className="text-xs">
          {logsState.entries.map((entry) => {
            return (
              <div key={entry.id} className="py-2 space-y-2">
                <h3 className="text-gray-900 font-bold uppercase">
                  {entry.name}
                </h3>

                {entry.patches.length ? (
                  <div>
                    {entry.patches.map((patch, i) => {
                      return (
                        <div key={i} className="flex gap-2">
                          <div className="whitespace-nowrap uppercase w-20 shrink-0">
                            {patch.op}
                          </div>
                          <div className="whitespace-nowrap grow">
                            {patch.path.join(".")}
                          </div>
                          <div className="whitespace-nowrap text-right shrink-0">
                            {patch.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p>NOOP</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
