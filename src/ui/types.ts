import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { Project, Operation } from '../core/schema';
export type Set<T> = Dispatch<SetStateAction<T>>;
export type InputRef = RefObject<HTMLInputElement | null>;
export type Command = (
  operations: Operation[],
  label: string,
  revision?: number,
) => Promise<boolean | undefined>;
export type Perform = (action: () => Promise<Project>) => Promise<boolean | undefined>;
export type History = { canUndo: boolean; canRedo: boolean };
export type Job = {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  revision: number;
  shotId: string;
};
export type PackInfo = {
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  builtin: boolean;
};
export type Modal = 'export' | 'connect' | 'recipes' | 'notes' | 'project' | null;
