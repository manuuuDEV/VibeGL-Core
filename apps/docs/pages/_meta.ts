const meta = {
  "index": "Introduction",
  "getting-started": "Getting Started",
  "api-reference": "API Reference"
};

export const docsMeta = meta;

// Next.js requires pages/* to default-export a React component. This file contains only metadata
// used elsewhere; export a tiny component so build succeeds while preserving the metadata export.
export default function Meta() {
  return null;
}
