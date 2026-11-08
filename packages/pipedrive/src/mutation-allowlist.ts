import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export function buildPipedriveDealStageBody(
  stageId: number,
  allowedTargetStageIds: number[] | undefined,
): Record<string, unknown> {
  if (
    allowedTargetStageIds !== undefined &&
    allowedTargetStageIds.length === 0
  ) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Deal target stage allowlist is explicitly empty.",
    );
  }
  if (
    allowedTargetStageIds !== undefined &&
    !allowedTargetStageIds.includes(stageId)
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Deal stage id is not an allowed target.",
    );
  }
  return { stage_id: stageId };
}
