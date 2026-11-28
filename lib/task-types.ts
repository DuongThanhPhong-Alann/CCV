export type TaskStatus = "draft" | "invited" | "accepted" | "declined";

export type TaskColumnSnapshot = { id?: string; name?: string; type?: string; pk?: boolean };
export type TaskEntitySnapshot = { id?: string; name?: string; columns?: TaskColumnSnapshot[] };
export type TaskRelationSnapshot = { id?: string; from?: string; to?: string; label?: string };

export type TaskSubmission = {
  version: number;
  submittedAt: string;
  diagramName: string;
  entities: TaskEntitySnapshot[];
  relations: TaskRelationSnapshot[];
  decorations: unknown[];
};

export type TaskGrade = {
  score: number;
  feedback: string;
  gradedAt: string;
  submissionVersion: number;
};

export type TaskDelivery = {
  id: string;
  assignedToName: string | null;
  assignedToEmail: string | null;
  status: TaskStatus;
  dueAt?: string | null;
  submission: { version: number; submittedAt?: string } | null;
  grade: { score: number; submissionVersion: number } | null;
  updatedAt: string;
};

export type AssignmentTask = {
  id: string;
  title: string;
  description: string;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedToImage?: string | null;
  sourceTaskId?: string | null;
  assignedCount?: number;
  deliveries?: TaskDelivery[];
  status: TaskStatus;
  dueAt?: string | null;
  diagramId: string | null;
  acceptedAt?: string | null;
  submission: TaskSubmission | null;
  grade: TaskGrade | null;
  createdAt: string;
  updatedAt: string;
};
