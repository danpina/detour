#!/usr/bin/env python3
"""Revokes the signing certificates that earlier CI runs created through the App Store Connect API.

Each TestFlight run starts on a fresh machine and lets Xcode create its own certificate, whose private key is thrown away
with the machine. Those certificates pile up until the account hits Apple's limit. Removing them before each run keeps the
count down. Certificates made by hand (in Xcode or the developer portal) are left alone: only ones Apple labels as
"Created via API" are revoked.

Needs ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH (a .p8 file) in the environment. Standard library plus the openssl command.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "https://api.appstoreconnect.apple.com/v1"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw(der: bytes) -> bytes:
    """Turns openssl's DER ECDSA signature into the raw r||s form JWT wants."""
    assert der[0] == 0x30
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    parts = []
    for _ in range(2):
        assert der[i] == 0x02
        n = der[i + 1]
        value = der[i + 2 : i + 2 + n].lstrip(b"\x00")
        parts.append(value.rjust(32, b"\x00"))
        i += 2 + n
    return parts[0] + parts[1]


def make_token(key_id: str, issuer: str, key_path: str) -> str:
    header = b64url(json.dumps({"alg": "ES256", "kid": key_id, "typ": "JWT"}).encode())
    now = int(time.time())
    payload = b64url(json.dumps({"iss": issuer, "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"}).encode())
    signing_input = (header + "." + payload).encode()
    der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key_path], input=signing_input, capture_output=True, check=True).stdout
    return header + "." + payload + "." + b64url(der_to_raw(der))


def call(method: str, url: str, token: str):
    request = urllib.request.Request(url, method=method, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(request) as response:
        body = response.read()
        return json.loads(body) if body else {}


def main() -> int:
    token = make_token(os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], os.environ["ASC_KEY_PATH"])
    try:
        certs = call("GET", API + "/certificates?limit=200", token).get("data", [])
    except urllib.error.HTTPError as error:
        print("::warning::Could not list certificates (" + str(error.code) + "): " + error.read().decode()[:300])
        return 0
    print("Certificates on the account: " + str(len(certs)))
    revoked = 0
    for cert in certs:
        attrs = cert.get("attributes", {})
        label = " | ".join(str(attrs.get(k)) for k in ("certificateType", "name", "displayName", "expirationDate"))
        if "via api" in str(attrs.get("name", "")).lower():
            try:
                call("DELETE", API + "/certificates/" + cert["id"], token)
                revoked += 1
                print("revoked: " + label)
            except urllib.error.HTTPError as error:
                print("::warning::Could not revoke " + label + " (" + str(error.code) + ")")
        else:
            print("kept:    " + label)
    print("Revoked " + str(revoked) + " leftover CI certificate(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
