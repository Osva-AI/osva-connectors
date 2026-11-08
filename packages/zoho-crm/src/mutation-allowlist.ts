import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { MAX_NOTE_BODY_LENGTH, MAX_NOTE_TITLE_LENGTH } from "./constants.js";

export function buildZohoDealStageBody(
  dealId: string,
  stage: string,
  allowedTargets: string[] | undefined,
): Record<string, unknown> {
  const trimmed = stage.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Deal stage is required.");
  }
  const permitted =
    allowedTargets === undefined ? undefined : new Set(allowedTargets);
  if (permitted !== undefined && permitted.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Deal stage target allowlist is explicitly empty.",
    );
  }
  if (
    permitted !== undefined &&
    !permitted.has(stage) &&
    !permitted.has(trimmed)
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Deal stage is not an allowed target.",
    );
  }
  return {
    data: [
      {
        id: dealId,
        Stage: trimmed,
      },
    ],
  };
}

export function buildZohoDealNoteBody(
  dealId: string,
  body: string,
  title?: string,
): Record<string, unknown> {
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0 || trimmedBody.length > MAX_NOTE_BODY_LENGTH) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Note body length is invalid.",
    );
  }
  const resolvedTitle = (title ?? "Note").trim();
  if (
    resolvedTitle.length === 0 ||
    resolvedTitle.length > MAX_NOTE_TITLE_LENGTH
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Note title length is invalid.",
    );
  }
  return {
    data: [
      {
        Note_Title: resolvedTitle,
        Note_Content: trimmedBody,
        Parent_Id: dealId,
        $is_shared_to_client: false,
      },
    ],
  };
}
