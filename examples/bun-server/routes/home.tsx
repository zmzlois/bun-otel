import React from "react";
import { Home } from "../pages/Home";

export function handleHome(): Response {
  return new Response(`<!DOCTYPE html>${(<Home />)}`, {
    headers: { "Content-Type": "text/html" },
  });
}
