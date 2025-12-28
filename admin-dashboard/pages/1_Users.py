import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import pandas as pd

st.set_page_config(page_title="Users - ViewFindr Admin", page_icon="👥", layout="wide")

# Reuse Firebase initialization from main app
@st.cache_resource
def init_firebase():
    if not firebase_admin._apps:
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

def check_password():
    def password_entered():
        if st.session_state["password"] == st.secrets["app"]["password"]:
            st.session_state["password_correct"] = True
            del st.session_state["password"]
        else:
            st.session_state["password_correct"] = False

    if "password_correct" not in st.session_state:
        st.text_input("Password", type="password", on_change=password_entered, key="password")
        return False
    elif not st.session_state["password_correct"]:
        st.text_input("Password", type="password", on_change=password_entered, key="password")
        st.error("😕 Password incorrect")
        return False
    return True

def main():
    st.title("👥 User Management")
    
    try:
        db = init_firebase()
    except Exception as e:
        st.error(f"Failed to connect to Firebase: {e}")
        return
    
    # Tabs for different actions
    tab1, tab2, tab3 = st.tabs(["📋 Whitelist", "➕ Add User", "📊 User Stats"])
    
    with tab1:
        st.subheader("Current Whitelist")
        
        whitelist_docs = list(db.collection("whitelist").stream())
        
        if whitelist_docs:
            # Build table data
            data = []
            for doc in whitelist_docs:
                d = doc.to_dict()
                added_at = d.get("addedAt")
                if added_at and hasattr(added_at, 'strftime'):
                    added_str = added_at.strftime("%Y-%m-%d")
                else:
                    added_str = "N/A"
                
                data.append({
                    "Email": d.get("email", doc.id),
                    "Name": d.get("name", ""),
                    "Status": "✅ Allowed" if d.get("allowed", True) else "❌ Blocked",
                    "Added": added_str,
                    "Added By": d.get("addedBy", "unknown"),
                })
            
            df = pd.DataFrame(data)
            st.dataframe(df, use_container_width=True, hide_index=True)
            
            # Delete user section
            st.divider()
            st.subheader("Remove User")
            
            emails = [doc.id for doc in whitelist_docs]
            email_to_remove = st.selectbox("Select user to remove", options=[""] + emails)
            
            if email_to_remove:
                col1, col2 = st.columns([1, 4])
                with col1:
                    if st.button("🗑️ Remove", type="secondary"):
                        db.collection("whitelist").document(email_to_remove).delete()
                        st.success(f"Removed {email_to_remove} from whitelist")
                        st.rerun()
        else:
            st.info("No users in whitelist yet")
    
    with tab2:
        st.subheader("Add New User")
        
        with st.form("add_user_form"):
            email = st.text_input("Email Address *", placeholder="friend@example.com")
            name = st.text_input("Name", placeholder="John Doe")
            
            submitted = st.form_submit_button("Add to Whitelist", type="primary")
            
            if submitted:
                if not email:
                    st.error("Email is required")
                elif "@" not in email:
                    st.error("Please enter a valid email address")
                else:
                    normalized_email = email.lower().strip()
                    
                    # Check if already exists
                    existing = db.collection("whitelist").document(normalized_email).get()
                    if existing.exists:
                        st.warning(f"{normalized_email} is already in the whitelist")
                    else:
                        db.collection("whitelist").document(normalized_email).set({
                            "email": normalized_email,
                            "name": name.strip() if name else "",
                            "allowed": True,
                            "addedAt": firestore.SERVER_TIMESTAMP,
                            "addedBy": "admin_dashboard"
                        })
                        st.success(f"✅ Added {normalized_email} to whitelist!")
                        st.balloons()
        
        # Bulk add section
        st.divider()
        st.subheader("Bulk Add Users")
        
        bulk_emails = st.text_area(
            "Enter emails (one per line)",
            placeholder="email1@example.com\nemail2@example.com\nemail3@example.com",
            height=150
        )
        
        if st.button("Add All"):
            if bulk_emails:
                emails = [e.strip().lower() for e in bulk_emails.split("\n") if e.strip() and "@" in e]
                added = 0
                for em in emails:
                    existing = db.collection("whitelist").document(em).get()
                    if not existing.exists:
                        db.collection("whitelist").document(em).set({
                            "email": em,
                            "name": "",
                            "allowed": True,
                            "addedAt": firestore.SERVER_TIMESTAMP,
                            "addedBy": "admin_dashboard_bulk"
                        })
                        added += 1
                st.success(f"Added {added} new users to whitelist")
                if added > 0:
                    st.rerun()
    
    with tab3:
        st.subheader("User Statistics")
        
        # Get all users from Firebase Auth would require different approach
        # For now, show stats from activity logs
        
        activity_logs = list(db.collection("activity_logs").limit(5000).stream())
        
        if activity_logs:
            # User activity counts
            user_activity = {}
            user_movies = {}
            
            for log in activity_logs:
                data = log.to_dict()
                email = data.get("userEmail", "unknown")
                action = data.get("action", "")
                
                if email not in user_activity:
                    user_activity[email] = 0
                    user_movies[email] = 0
                
                user_activity[email] += 1
                if action == "movie_logged":
                    user_movies[email] += 1
            
            # Build stats table
            stats_data = []
            for email in user_activity:
                stats_data.append({
                    "User": email,
                    "Total Actions": user_activity[email],
                    "Movies Logged": user_movies[email],
                })
            
            df = pd.DataFrame(stats_data)
            df = df.sort_values("Total Actions", ascending=False)
            
            st.dataframe(df, use_container_width=True, hide_index=True)
            
            # Chart
            st.bar_chart(df.set_index("User")["Total Actions"].head(10))
        else:
            st.info("No activity data yet")

if __name__ == "__main__":
    if check_password():
        main()

