import { useSyncExternalStore } from "react";
import { createStore } from "./store";
import { createSyncClient } from "./client";

const colors = ["brown", "deeppink", "coral", "chartreuse", "gold"] as const;

const templateId = "test";

const client = await createSyncClient();
const room = await client.sync(templateId);
const store = createStore({ room });

type Action =
  | { type: "RESIZE"; width: number; height: number }
  | { type: "SCALE"; by: number }
  | { type: "SET_COLOR"; color: string };

const dispatch = (action: Action, shouldAddToHistory = false) => {
  // const templateSnapshot = templateStore.getState();

  store.mutate(
    {
      apply: (draft) => {
        switch (action.type) {
          case "RESIZE": {
            draft.size.width = action.width;
            draft.size.height = action.height;

            if (draft.size.width === draft.size.height) {
              draft.color = "blue";
            }
            break;
          }
          case "SCALE": {
            draft.size.width = draft.size.width * action.by;
            draft.size.height = draft.size.height * action.by;
            break;
          }
          case "SET_COLOR": {
            draft.color = action.color;
            break;
          }
        }
      },
    },
    shouldAddToHistory
  );
};

const Button = (props: React.ComponentPropsWithoutRef<"button">) => {
  return (
    <button
      className="w-full uppercase text-sm tracking-widest rounded bg-gray-200 p-2 hover:bg-gray-300 transition-colors text-gray-700"
      type="button"
      {...props}
    />
  );
};

const useTemplate = () => {
  return useSyncExternalStore(store.subscribe, store.getState);
};

export const App = () => {
  const template = useTemplate();

  return (
    <div className="flex">
      <div className="grow overflow-hidden">
        <div
          style={{
            width: template.size.width,
            height: template.size.height,
            background: template.color,
          }}
        />
      </div>

      <div className="w-96 h-screen overflow-y-auto shrink-0 font-mono text-gray-600 px-4 bg-gray-100 divide-y divide-gray-200 border-l border-l-gray-200">
        <div className="flex py-2 gap-2">
          <Button
            onClick={(e) => {
              e.preventDefault();
              store.undo();
            }}
          >
            Undo
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              store.redo();
            }}
          >
            Redo
          </Button>
        </div>

        <div className="flex flex-col py-2 gap-2">
          {colors.map((color) => {
            return (
              <Button
                key={color}
                onClick={(e) => {
                  e.preventDefault();
                  dispatch({ type: "SET_COLOR", color }, true);
                }}
              >
                {color}
              </Button>
            );
          })}
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

          <Button type="submit">Resize</Button>
        </form>
      </div>
    </div>
  );
};
