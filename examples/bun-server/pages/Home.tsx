import React from "react";

export function Home() {
  return (
    <html>
      <head>
        <title>Bun Server Example</title>
        <style>
          {`
            body {
              font-family: system-ui;
              max-width: 800px;
              margin: 2rem auto;
              padding: 0 1rem;
            }
            h1 { color: #333; }
            .card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 1.5rem;
              margin: 1rem 0;
              background: #f9f9f9;
            }
            .endpoint {
              background: #fff;
              padding: 0.75rem;
              margin: 0.5rem 0;
              border-left: 3px solid #4CAF50;
            }
          `}
        </style>
      </head>
      <body>
        <h1>🥟 Bun Server with OpenTelemetry</h1>
        <div className="card">
          <h2>Available Endpoints</h2>
          <p>This server is instrumented with OpenTelemetry for distributed tracing.</p>

          <div className="endpoint">
            <strong>GET /</strong> - This page
          </div>

          <div className="endpoint">
            <strong>GET /health</strong> - Health check endpoint
          </div>

          <div className="endpoint">
            <strong>GET /slow</strong> - Slow endpoint (simulates processing)
          </div>

          <div className="endpoint">
            <strong>GET /users</strong> - Fetch users from mock API
          </div>

          <div className="endpoint">
            <strong>GET /error</strong> - Trigger an error (for testing)
          </div>

          <div className="endpoint">
            <strong>GET /external</strong> - Make external API call
          </div>
        </div>
      </body>
    </html>
  );
}
