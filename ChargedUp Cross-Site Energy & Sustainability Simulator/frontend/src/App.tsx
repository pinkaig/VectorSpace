import { useEffect, useState } from "react";
import { fetchSites } from "./api/client";
import type { Site } from "./types/api";

export function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchSites().then(setSites).catch(() => setError("Backend unavailable")); }, []);
  return <main><h1>ChargedUp</h1><p>Cross-site energy and sustainability simulator</p>{error ? <p role="alert">{error}</p> : <ul>{sites.map((site) => <li key={site.id}>{site.name} · {site.type}</li>)}</ul>}</main>;
}
