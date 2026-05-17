"""
Auth guard for Streamlit.
Returns the session dict if authenticated, None if not.
Every page calls this at the top — no page renders data without passing it.
"""

import streamlit as st


def require_auth() -> dict | None:
    token = st.session_state.get("access_token")
    user_id = st.session_state.get("user_id")

    if not token or not user_id:
        return None

    return {"access_token": token, "user_id": user_id}
