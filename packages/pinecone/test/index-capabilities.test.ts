import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertDenseIndexForVectorOps,
  assertServerlessIndexForList,
  assertVectorLengthMatchesIndex,
} from "../src/index-capabilities.js";

describe("assertDenseIndexForVectorOps", () => {
  it("rejects sparse indexes", () => {
    expect(() =>
      assertDenseIndexForVectorOps({
        name: "sparse-index",
        vector_type: "sparse",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects integrated embedding indexes", () => {
    expect(() =>
      assertDenseIndexForVectorOps({
        name: "embed-index",
        vector_type: "dense",
        spec: { embed: { model: "x" } },
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts dense indexes", () => {
    expect(() =>
      assertDenseIndexForVectorOps({
        name: "docs",
        vector_type: "dense",
        spec: { serverless: { cloud: "aws", region: "us-east-1" } },
      }),
    ).not.toThrow();
  });
});

describe("assertServerlessIndexForList", () => {
  it("rejects pod-based indexes", () => {
    expect(() =>
      assertServerlessIndexForList({
        spec: { pod: { environment: "us-east-1-aws" } },
      }),
    ).toThrow(ConnectorSdkError);
  });
});

describe("assertVectorLengthMatchesIndex", () => {
  it("rejects dimension mismatch before provider call", () => {
    expect(() => assertVectorLengthMatchesIndex({ dimension: 3 }, 4)).toThrow(
      ConnectorSdkError,
    );
  });
});
