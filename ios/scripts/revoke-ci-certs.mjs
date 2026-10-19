// Revokes leftover signing certificates created by earlier CI runs ("Created via API").
//
// Why: CI runners are fresh machines. With automatic signing, every build asks Apple for a new certificate and the
// runner (and its private key) is then thrown away. Apple limits how many certificates an account can have, so after
// enough builds across all your apps the next build fails with "Your account has reached the maximum number of
// certificates". Those leftover certificates are unusable by anyone, so revoking them is safe.
//
// It only touches certificates whose name contains "Created via API", and skips any created in the last 30 minutes
// so a build running in another repo at the same time is not disturbed. Certificates made by hand in Xcode or on
// developer.apple.com are never touched.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to the .p8 file).
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
  console.error("Missing ASC_KEY_ID, ASC_ISSUER_ID or ASC_KEY_PATH");
  process.exit(1);
}

const b64url = (input) => Buffer.from(input).toString("base64url");

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const key = createPrivateKey(readFileSync(ASC_KEY_PATH, "utf8"));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(signature)}`;
}

const jwt = token();
const api = async (path, options = {}) => {
  const res = await fetch(path.startsWith("http") ? path : `https://api.appstoreconnect.apple.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${jwt}`, ...(options.headers ?? {}) },
  });
  if (!res.ok && res.status !== 204) throw new Error(`${options.method ?? "GET"} ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
};

const certs = [];
let url = "/v1/certificates?limit=200";
while (url) {
  const page = await api(url);
  certs.push(...page.data);
  url = page.links?.next ?? null;
}

console.log(`Account has ${certs.length} certificate(s):`);
const YEAR_MS = 365 * 24 * 3600 * 1000;
const RECENT_MS = 30 * 60 * 1000;
let revoked = 0;

for (const c of certs) {
  const a = c.attributes;
  const expires = new Date(a.expirationDate).getTime();
  const ageMs = Date.now() - (expires - YEAR_MS); // certificates last one year
  const label = `${a.certificateType} "${a.name}" expires ${a.expirationDate.slice(0, 10)}`;
  if (!/created via api/i.test(a.name ?? "")) {
    console.log(`  keep    ${label} (not made by CI)`);
  } else if (ageMs < RECENT_MS) {
    console.log(`  keep    ${label} (created in the last 30 minutes)`);
  } else {
    await api(`/v1/certificates/${c.id}`, { method: "DELETE" });
    revoked++;
    console.log(`  revoked ${label}`);
  }
}
console.log(`Done. Revoked ${revoked} leftover CI certificate(s).`);
