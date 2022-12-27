import * as z from "zod";
import { uuid } from "./helpers/uuid";

export type Template = {
  id: string;
  size: { width: number; height: number };
  color: string;
};

export const makeTemplate = (props: Partial<Template> = {}): Template => {
  return {
    id: uuid(),
    size: { width: 200, height: 200 },
    color: "red",
    ...props,
  };
};

export const watchParamsSchema = z.object({ templateId: z.string() });
export type WatchParams = z.infer<typeof watchParamsSchema>;

const patchScema = z.object({
  op: z.union([z.literal("replace"), z.literal("remove"), z.literal("add")]),
  path: z.array(z.union([z.string(), z.number()])),
  value: z.any(),
});
export type Patch = z.infer<typeof patchScema>;

export const mutationSchema = z.object({
  id: z.string().uuid(),
  patches: z.array(patchScema),
});
export type Mutation = z.infer<typeof mutationSchema>;
export const makeMutation = (props: Partial<Mutation> = {}) => {
  return {
    id: uuid(),
    patches: [],
    ...props,
  };
};

export const mutateParamsSchema = z.object({
  lastMutationId: z.string().uuid(),
  mutation: mutationSchema,
});
export type MutateParams = z.infer<typeof mutateParamsSchema>;

export type RoomState = {
  lastMutationId: string;
  template: Template;
};

export type Room = {
  initialState: RoomState;
  onMutate: (fn: (params: MutateParams) => void) => void;
  mutate: (params: MutateParams) => Promise<boolean>;
  leave: () => void;
};
