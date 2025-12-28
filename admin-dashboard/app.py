import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import pandas as pd

# Page config
st.set_page_config(
    page_title="ViewFindr Admin",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize Firebase (only once)
@st.cache_resource
def init_firebase():
    """Initialize Firebase Admin SDK"""
    if not firebase_admin._apps:
        # Load credentials from Streamlit secrets
        cred_dict = {
            "type": st.secrets["firebase"]["type"],
            "project_id": st.secrets["firebase"]["project_id"],
            "private_key_id": st.secrets["firebase"]["private_key_id"],
            "private_key": st.secrets["firebase"]["private_key"].replace("\\n", "\n"),
            "client_email": st.secrets["firebase"]["client_email"],
            "client_id": st.secrets["firebase"]["client_id"],
            "auth_uri": st.secrets["firebase"]["auth_uri"],
            "token_uri": st.secrets["firebase"]["token_uri"],
            "auth_provider_x509_cert_url": st.secrets["firebase"]["auth_provider_x509_cert_url"],
            "client_x509_cert_url": st.secrets["firebase"]["client_x509_cert_url"],
        }
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    return firestore.client()

# Simple password protection
def check_password():
    """Returns True if the user entered the correct password."""
    
    def password_entered():
        """Checks whether a password entered by the user is correct."""
        if st.session_state["password"] == st.secrets["app"]["password"]:
            st.session_state["password_correct"] = True
            del st.session_state["password"]  # Don't store password
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        # First run, show input for password
        st.text_input(
            "Password", type="password", on_change=password_entered, key="password"
        )
        return False
    elif not st.session_state["password_correct"]:
        # Password incorrect, show input + error
        st.text_input(
            "Password", type="password", on_change=password_entered, key="password"
        )
        st.error("😕 Password incorrect")
        return False
    else:
        # Password correct
        return True

# Main app
def main():
    st.title("🎬 ViewFindr Admin Dashboard")
    
    # Initialize Firebase
    try:
        db = init_firebase()
    except Exception as e:
        st.error(f"Failed to connect to Firebase: {e}")
        st.info("Make sure you've configured the Firebase credentials in .streamlit/secrets.toml")
        return
    
    # Dashboard metrics
    st.header("📊 Overview")
    
    col1, col2, col3, col4 = st.columns(4)
    
    # Get whitelist count
    whitelist_docs = list(db.collection("whitelist").stream())
    whitelist_count = len(whitelist_docs)
    
    # Get activity logs from last 24 hours
    yesterday = datetime.now() - timedelta(hours=24)
    recent_logs = list(
        db.collection("activity_logs")
        .where("timestamp", ">=", yesterday)
        .stream()
    )
    
    # Get unique active users today
    active_users = set()
    movies_logged_today = 0
    for log in recent_logs:
        data = log.to_dict()
        active_users.add(data.get("userId", "unknown"))
        if data.get("action") == "movie_logged":
            movies_logged_today += 1
    
    # Get total activity logs
    all_logs = list(db.collection("activity_logs").limit(1000).stream())
    
    with col1:
        st.metric("Whitelisted Users", whitelist_count)
    
    with col2:
        st.metric("Active Today", len(active_users))
    
    with col3:
        st.metric("Movies Logged (24h)", movies_logged_today)
    
    with col4:
        st.metric("Total Activities", len(all_logs))
    
    st.divider()
    
    # Recent activity feed
    st.header("🕐 Recent Activity")
    
    if recent_logs:
        activity_data = []
        for log in sorted(recent_logs, key=lambda x: x.to_dict().get("timestamp", datetime.min), reverse=True)[:20]:
            data = log.to_dict()
            timestamp = data.get("timestamp")
            if timestamp:
                time_str = timestamp.strftime("%H:%M") if hasattr(timestamp, 'strftime') else str(timestamp)
            else:
                time_str = "N/A"
            
            activity_data.append({
                "Time": time_str,
                "User": data.get("userEmail", "unknown")[:20] + "...",
                "Action": data.get("action", "unknown"),
                "Details": str(data.get("metadata", {}))[:50] + "..."
            })
        
        df = pd.DataFrame(activity_data)
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("No recent activity")
    
    st.divider()
    
    # Quick actions
    st.header("⚡ Quick Actions")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Add User to Whitelist")
        new_email = st.text_input("Email address", key="quick_add_email")
        new_name = st.text_input("Name (optional)", key="quick_add_name")
        
        if st.button("Add to Whitelist", type="primary"):
            if new_email:
                normalized_email = new_email.lower().strip()
                db.collection("whitelist").document(normalized_email).set({
                    "email": normalized_email,
                    "name": new_name or "",
                    "allowed": True,
                    "addedAt": firestore.SERVER_TIMESTAMP,
                    "addedBy": "admin_dashboard"
                })
                st.success(f"✅ Added {normalized_email} to whitelist!")
                st.rerun()
            else:
                st.warning("Please enter an email address")
    
    with col2:
        st.subheader("Current Whitelist")
        for doc in whitelist_docs:
            data = doc.to_dict()
            email = data.get("email", doc.id)
            name = data.get("name", "")
            display = f"{email}" + (f" ({name})" if name else "")
            st.text(f"• {display}")

if __name__ == "__main__":
    if check_password():
        main()
