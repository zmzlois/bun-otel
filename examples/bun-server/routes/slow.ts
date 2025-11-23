export async function handleSlow(): Promise<Response> {
  await Bun.sleep(2000); // 2 second delay

  return Response.json({
    message: "Slow operation completed",
    duration_ms: 2000,
  });
}
