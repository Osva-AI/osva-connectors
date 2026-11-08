export interface MixpanelCredentials {
  readonly username: string;
  readonly secret: string;
}

export interface MixpanelAuthProvider {
  getAuthorizationHeader(): string;
  readonly username: string;
  readonly secret: string;
}

export function createMixpanelAuthProvider(
  credentials: MixpanelCredentials,
): MixpanelAuthProvider {
  const username = credentials.username.trim();
  const secret = credentials.secret.trim();
  const token = Buffer.from(`${username}:${secret}`, "utf8").toString("base64");

  return {
    username,
    secret,
    getAuthorizationHeader(): string {
      return `Basic ${token}`;
    },
  };
}

export function createStaticMixpanelAuthProvider(
  username: string,
  secret: string,
): MixpanelAuthProvider {
  return createMixpanelAuthProvider({ username, secret });
}
