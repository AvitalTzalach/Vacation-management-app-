/**
 * Integration tests of LoginHandler: credentials check and the issued JWT.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDataSource, getDataSource } from "../../src/database/data-source";
import { verifyToken } from "../../src/modules/auth/jwt";
import { LoginCommand, LoginHandler } from "../../src/modules/auth/login.command";
import { UserRole } from "../../src/modules/users/user.entity";
import { UnauthorizedError } from "../../src/shared/errors";
import { createUser, resetDatabase, TEST_PASSWORD } from "./helpers";

const handler = new LoginHandler(getDataSource);

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDataSource();
});

describe("LoginHandler", () => {
  it("returns a valid token and the public user data", async () => {
    const user = await createUser({ name: "Sarah", email: "sarah@test.local", role: UserRole.Validator });

    const result = await handler.execute(new LoginCommand("sarah@test.local", TEST_PASSWORD));

    expect(result.user).toEqual({ id: user.id, name: "Sarah", email: "sarah@test.local", role: "Validator" });
    expect(result.user).not.toHaveProperty("password");
    expect(verifyToken(result.token)).toEqual({ userId: user.id, role: UserRole.Validator });
  });

  it("refuses a wrong password", async () => {
    await createUser({ email: "maya@test.local" });
    await expect(handler.execute(new LoginCommand("maya@test.local", "wrong"))).rejects.toThrow(
      new UnauthorizedError("Invalid email or password.")
    );
  });

  it("gives the same answer for an unknown email (no account enumeration)", async () => {
    await expect(handler.execute(new LoginCommand("nobody@test.local", "whatever"))).rejects.toThrow(
      new UnauthorizedError("Invalid email or password.")
    );
  });

  it("never loads the password hash by default", async () => {
    const user = await createUser();
    const loaded = await (await getDataSource()).getRepository("User").findOneBy({ id: user.id });
    expect(loaded).not.toHaveProperty("password");
  });
});
