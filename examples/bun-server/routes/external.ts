import { callExternalAPI } from "../helpers/api";

export async function handleExternalCall(): Promise<Response> {
  try {
    const response = await callExternalAPI("https://httpbin.org/json");
    const data = await response.json();

    return Response.json({
      message: "External API call successful",
      data,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to call external API",
        message: (error as Error).message,
      },
      { status: 502 },
    );
  }
}
