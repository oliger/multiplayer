import { MutateParams, Room } from "./types";
import { io, Socket } from "socket.io-client";
import { RoomState } from "./types";

export const createSyncClient = async () => {
  // TODO: Handle deconnection and reconnection.
  const socket = await new Promise<Socket>((resolve) => {
    const socket = io("ws://localhost:3000", {
      transports: ["websocket"],
      path: "/sync",
    });

    socket.once("connect", () => {
      resolve(socket);
    });
  });

  const sync = async (templateId: string): Promise<Room> => {
    const initialState = await new Promise<RoomState>((resolve) => {
      socket.once(`template:${templateId}:state`, (initialState) => {
        resolve(initialState);
      });
      socket.emit("join", { templateId });
    });

    const onMutate = (fn: (params: MutateParams) => void) => {
      const eventName = `template:${templateId}:mutation`;
      socket.on(eventName, fn);

      return () => socket.off(eventName, fn);
    };

    const mutate = async (params: MutateParams) => {
      return new Promise<boolean>((resolve) => {
        socket.emit(`template:${templateId}:mutate`, params, (res: unknown) => {
          resolve(res === "ACK");
        });
      });
    };

    const leave = () => {
      socket.emit(`template:${templateId}:leave`);
    };

    return {
      initialState,
      mutate,
      onMutate,
      leave,
    };
  };

  return {
    sync,
  };
};
