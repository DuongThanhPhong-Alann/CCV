import type { TaskGrade, TaskStatus } from "@/lib/task-types";

export type CodeFileLanguage = "html" | "css" | "js" | "json" | "md" | "txt";

export type CodeFile = {
  id: string;
  name: string;
  language: CodeFileLanguage;
  content: string;
};

export type CodeBundle = {
  html: string;
  css: string;
  js: string;
  files?: CodeFile[];
};

export type CodeCriterionType =
  | "text_contains"
  | "element_exists"
  | "element_text"
  | "style_color"
  | "style_align"
  | "style_property"
  | "attribute_check"
  | "behavior_test"
  | "console_contains"
  | "js_analysis";

export type CodeBehaviorStep =
  | { action: "set_value"; target: string; value: string }
  | { action: "select_option"; target: string; optionText: string }
  | { action: "click"; target: string }
  | { action: "wait"; ms?: number }
  | { action: "assert_text"; pattern: string; regex?: boolean; absent?: boolean; scope?: string }
  | { action: "assert_count"; selector: string; min?: number; max?: number; exact?: number }
  | { action: "assert_row_contains"; rowMatch: string; expected: string }
  | { action: "assert_style"; selector: string; check: "color" | "bg" | "center" | "rounded"; expected: string };

export type CodeCriterion = {
  id: string;
  type: CodeCriterionType;
  label: string;
  selector: string;
  property?: string;
  attribute?: string;
  expected: string;
  minCount?: number;
  weight: number;
  steps?: CodeBehaviorStep[];
};

export type CodeCriterionResult = {
  criterionId: string;
  label: string;
  type: CodeCriterionType;
  passed: boolean;
  expected: string;
  actual: string;
  weight: number;
};

export type CodeAutoGradeResult = {
  percentage: number;
  earnedPoints: number;
  totalPoints: number;
  passed: boolean;
  passedCount: number;
  totalCount: number;
  passThreshold: number;
  results: CodeCriterionResult[];
  consoleLogs: string[];
  errors: string[];
  evaluatedAt: string;
};

export type CodeRunSnapshot = {
  code: CodeBundle;
  autoGrade: CodeAutoGradeResult;
  runCount: number;
  ranAt: string;
};

export type CodeSubmission = {
  version: number;
  submittedAt: string;
  code: CodeBundle;
  autoGrade: CodeAutoGradeResult;
  runCount: number;
};

export type CodeTaskDelivery = {
  id: string;
  assignedToName: string | null;
  assignedToEmail: string | null;
  status: TaskStatus;
  dueAt?: string | null;
  lastRun: {
    percentage: number;
    earnedPoints?: number;
    totalPoints?: number;
    passed: boolean;
    passedCount: number;
    totalCount: number;
    runCount: number;
    ranAt: string;
  } | null;
  submission: {
    version: number;
    submittedAt: string;
    percentage: number;
    earnedPoints?: number;
    totalPoints?: number;
    passed: boolean;
    passedCount: number;
    totalCount: number;
  } | null;
  grade: {
    score: number;
    submissionVersion: number;
    auto?: boolean;
  } | null;
  updatedAt: string;
};

export type CodeTask = {
  id: string;
  taskType: "code";
  title: string;
  description: string;
  category?: string;
  difficulty?: string;
  starterCode: CodeBundle;
  solutionCode?: CodeBundle;
  criteria: CodeCriterion[];
  passThreshold: number;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  sourceTaskId?: string | null;
  assignedCount?: number;
  deliveries?: CodeTaskDelivery[];
  status: TaskStatus;
  dueAt?: string | null;
  acceptedAt?: string | null;
  savedCode?: CodeBundle | null;
  lastRun: CodeRunSnapshot | null;
  submission: CodeSubmission | null;
  grade: (TaskGrade & { auto?: boolean }) | null;
  createdAt: string;
  updatedAt: string;
};
