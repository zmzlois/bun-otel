export function handle404(pathname: string): Response {
  return Response.json(
    {
      error: "Not Found",
      path: pathname,
    },
    { status: 404 }
  );
}
