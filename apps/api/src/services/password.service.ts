import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to Argon2id. Parameters follow OWASP's minimum recommendation
// (19 MiB memory, 2 iterations, 1 lane).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const passwordService = {
  hash: (plain: string) => hash(plain, OPTIONS),

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  },
};

let dummy: Promise<string> | undefined;
/** Verifying against a dummy hash keeps response time similar for unknown emails. */
export const verifyAgainstDummy = async (plain: string) => {
  const pending = (dummy ??= passwordService.hash("dummy-password-for-timing-equalisation"));
  await passwordService.verify(await pending, plain);
};
