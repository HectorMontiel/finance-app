"""
ONE-TIME script to authorize Gmail access and save a token.json.

Run this LOCALLY (not in CI). It opens a browser window for you to approve access.
After approval, it saves token.json — upload that file as a GitHub/Render secret.

Usage:
    GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy python infrastructure/scripts/oauth2_setup.py

What happens after this:
    - token.json contains an access_token (short-lived) + refresh_token (long-lived).
    - The GmailConnector automatically refreshes the access_token before each run.
    - You never need to run this script again unless you revoke access in Google Console.
"""

import json
import os
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
_OUTPUT_PATH = Path("token.json")


def main() -> None:
    client_id = os.environ["GMAIL_CLIENT_ID"]
    client_secret = os.environ["GMAIL_CLIENT_SECRET"]

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, _SCOPES)
    creds = flow.run_local_server(port=0)

    _OUTPUT_PATH.write_text(creds.to_json())
    print(f"\n✓ token.json saved to {_OUTPUT_PATH.resolve()}")
    print("Next steps:")
    print("  1. Add token.json as a GitHub Actions secret named GMAIL_TOKEN_JSON")
    print("  2. In your workflow, write the secret to /run/secrets/gmail_token.json")
    print("  3. Set GMAIL_TOKEN_PATH=/run/secrets/gmail_token.json in your env")


if __name__ == "__main__":
    main()
