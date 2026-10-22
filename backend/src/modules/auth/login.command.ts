/**
 * LoginCommand — checks an email / password pair and issues a JWT.
 */
import bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { Command, CommandHandler } from "../../shared/cqrs/command-bus";
import { UnauthorizedError } from "../../shared/errors";
import { User, UserRole } from "../users/user.entity";
import { signToken } from "./jwt";

// Public user data returned at login (never the password hash).
export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

export class LoginCommand extends Command<LoginResult> {
  constructor(
    readonly email: string,
    readonly password: string
  ) {
    super();
  }
}

// Same message for "unknown email" and "wrong password", so the API does not reveal
// which email addresses have an account.
const INVALID_CREDENTIALS = "Invalid email or password.";

export class LoginHandler implements CommandHandler<LoginCommand> {
  // Hash of a random value, compared when the email is unknown (see `execute`).
  private dummyHash: string | null = null;

  constructor(private readonly getDataSource: () => Promise<DataSource>) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const dataSource = await this.getDataSource();

    // `password` is excluded from queries by default (select: false), so it is added explicitly.
    const user = await dataSource
      .getRepository(User)
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.email = :email", { email: command.email })
      .getOne();

    // A bcrypt comparison runs even when the email is unknown, so both cases take about the
    // same time and the response time does not reveal whether the account exists.
    const hash = user?.password ?? this.getDummyHash();
    const passwordMatches = await bcrypt.compare(command.password, hash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    return {
      token: signToken({ userId: user.id, role: user.role }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  // Computed once, on first use.
  private getDummyHash(): string {
    if (!this.dummyHash) {
      this.dummyHash = bcrypt.hashSync(String(Math.random()), 10);
    }
    return this.dummyHash;
  }
}
