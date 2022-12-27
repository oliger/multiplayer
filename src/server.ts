import { Server } from "socket.io";
import { applyPatches } from "./helpers/immer";
import { uuid } from "./helpers/uuid";
import {
  makeTemplate,
  mutateParamsSchema,
  RoomState,
  watchParamsSchema,
} from "./types";

const db = new Map<string, RoomState>();

const getOrMakeState = (templateId: string) => {
  const state = db.get(templateId);
  if (state) return state;

  const newState: RoomState = {
    lastMutationId: uuid(),
    template: makeTemplate({ id: templateId }),
  };
  db.set(templateId, newState);
  return newState;
};

getOrMakeState("test");

const io = new Server({
  transports: ["websocket"],
  path: "/sync",
  serveClient: false,
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  socket.on("join", async (watchData) => {
    const watchResult = watchParamsSchema.safeParse(watchData);
    if (!watchResult.success) return;

    const { templateId } = watchResult.data;
    const roomId = `template:${templateId}`;

    const state = getOrMakeState(templateId);

    socket.join(roomId);
    socket.once(`${roomId}:leave`, () => {
      socket.leave(roomId);
    });

    socket.on(`${roomId}:mutate`, (mutateData, cb) => {
      if (typeof cb !== "function") return;

      const ack = () => cb("ACK");
      const nack = () => cb("NACK");

      const mutateResult = mutateParamsSchema.safeParse(mutateData);
      if (!mutateResult.success) return nack();

      const previousState = db.get(templateId);
      if (!previousState) return nack();

      const { lastMutationId, mutation } = mutateResult.data;
      if (previousState.lastMutationId !== lastMutationId) {
        return nack();
      }
      const nextState: RoomState = {
        lastMutationId: mutation.id,
        template: applyPatches(previousState.template, mutation.patches),
      };
      db.set(templateId, nextState);

      socket.to(roomId).emit(`${roomId}:mutation`, mutateResult.data);

      ack();
    });

    socket.emit(`template:${templateId}:state`, state);
  });
});

io.listen(3000);
