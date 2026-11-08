import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_STAGE_NAME_LENGTH, MAX_TASK_SUBJECT_LENGTH } from "./constants.js";

export function buildOpportunityStagePatchBody(
  stageName: string,
  allowedTargets: string[] | undefined,
): Record<string, unknown> {
  const trimmed = stageName.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_STAGE_NAME_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Opportunity stage name length is invalid.",
    );
  }
  if (allowedTargets !== undefined) {
    const permitted = new Set(
      allowedTargets.map((s) => s.trim()).filter((s) => s.length > 0),
    );
    if (permitted.size === 0 || !permitted.has(trimmed)) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Opportunity stage is not an allowed target.",
      );
    }
  }
  return { StageName: trimmed };
}

export function buildTaskCreateBody(input: {
  readonly subject: string;
  readonly relatedRecordType: "Account" | "Opportunity" | "Contact";
  readonly relatedRecordId: string;
  readonly dueDate?: string;
  readonly defaultTaskStatus?: string;
}): Record<string, unknown> {
  const subject = input.subject.trim();
  if (subject.length === 0 || subject.length > MAX_TASK_SUBJECT_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Task subject length is invalid.",
    );
  }
  const body: Record<string, unknown> = { Subject: subject };
  if (
    input.defaultTaskStatus !== undefined &&
    input.defaultTaskStatus.length > 0
  ) {
    body.Status = input.defaultTaskStatus;
  }
  if (input.dueDate !== undefined) {
    body.ActivityDate = input.dueDate;
  }
  if (input.relatedRecordType === "Contact") {
    body.WhoId = input.relatedRecordId;
  } else {
    body.WhatId = input.relatedRecordId;
  }
  return body;
}
