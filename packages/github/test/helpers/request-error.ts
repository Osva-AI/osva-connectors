import { RequestError } from "@octokit/request-error";

export function createGithubRequestError(
  status: number,
  message: string,
  responseHeaders: Record<string, string> = {},
): RequestError {
  return new RequestError(message, status, {
    request: {
      method: "GET",
      url: "https://api.github.com/repos/o/r",
      headers: {},
    },
    response: {
      status,
      url: "https://api.github.com/repos/o/r",
      headers: responseHeaders,
      data: {},
    },
  });
}
