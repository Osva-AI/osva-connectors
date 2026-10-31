import { NPM_DOWNLOADS_PERIOD_LAST_MONTH } from "./schemas.js";

export const packageMetadataInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["packageName"],
  properties: {
    packageName: {
      type: "string",
      minLength: 1,
      description:
        "npm package name, including scoped names such as @scope/pkg.",
    },
  },
} as const;

export const downloadsInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["packageName", "period"],
  properties: {
    packageName: {
      type: "string",
      minLength: 1,
      description:
        "npm package name, including scoped names such as @scope/pkg.",
    },
    period: {
      type: "string",
      enum: [NPM_DOWNLOADS_PERIOD_LAST_MONTH],
      description:
        "Download window. Canonical v1 supports last-month via the npm downloads API point endpoint.",
    },
  },
} as const;
