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
              margin: 50px auto;
              padding: 20px;
            }
            h1 {
              color: #333;
            }
            .endpoint {
              background: #f5f5f5;
              padding: 15px;
              margin: 10px 0;
              border-radius: 5px;
            }
            code {
              background: #e0e0e0;
              padding: 2px 6px;
              border-radius: 3px;
            }
          `}
        </style>
      </head>
      <body>
        <h1>🚀 Bun Server Example</h1>
        <p>A simple Bun HTTP server</p>

        <h2>Available Endpoints:</h2>

        <div className="endpoint">
          <h3>GET /api/users</h3>
          <p>Returns a list of users with simulated database query</p>
        </div>

        <div className="endpoint">
          <h3>GET /api/external</h3>
          <p>Makes an external API call</p>
        </div>

        <div className="endpoint">
          <h3>GET /api/error</h3>
          <p>Triggers an error for testing</p>
        </div>

        <div className="endpoint">
          <h3>GET /api/slow</h3>
          <p>Simulates a slow request</p>
        </div>

        <div className="endpoint">
          <h3>GET /health</h3>
          <p>Health check endpoint</p>
        </div>
      </body>
    </html>
  );
}
