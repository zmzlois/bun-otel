import { simulateDatabaseQuery } from "../helpers/db";

export async function handleUsers(): Promise<Response> {
  // Simulate database query
  await simulateDatabaseQuery("SELECT * FROM users WHERE active = true LIMIT 10");

  const users = [
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
    { id: 3, name: "Charlie", email: "charlie@example.com" },
  ];

  return Response.json({
    users,
    metadata: {
      count: users.length,
    },
  });
}
