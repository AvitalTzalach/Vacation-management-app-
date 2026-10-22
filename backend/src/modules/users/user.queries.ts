/**
 * Read-side queries of the users module.
 */
import { DataSource } from "typeorm";
import { User, UserRole } from "./user.entity";

// Public user data used by the dashboard's "employee" filter.
export interface UserSummaryDto {
  id: number;
  name: string;
}

/**
 * Lists the users who can own vacation requests (role Requester), sorted by name.
 * Only `id` and `name` are selected: no email, no password.
 */
export async function listRequesters(dataSource: DataSource): Promise<UserSummaryDto[]> {
  const users = await dataSource.getRepository(User).find({
    select: { id: true, name: true },
    where: { role: UserRole.Requester },
    order: { name: "ASC", id: "ASC" },
  });
  return users.map(({ id, name }) => ({ id, name }));
}
