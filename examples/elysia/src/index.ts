import { Elysia } from "elysia";

const app = new Elysia().get("/", () => "Hello Elysia").listen(process.env.PORT ?? 3002);

console.log(`elysia is running at ${app.server?.hostname}:${app.server?.port}`);
