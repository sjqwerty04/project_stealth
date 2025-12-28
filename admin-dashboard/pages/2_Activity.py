import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import pandas as pd

st.set_page_config(page_title="Activity - ViewFindr Admin", page_icon="📊", layout="wide")

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
    st.title("📊 Activity Logs")
    
    try:
        db = init_firebase()
    except Exception as e:
        st.error(f"Failed to connect to Firebase: {e}")
        return
    
    # Filters
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        time_filter = st.selectbox(
            "Time Range",
            ["Last Hour", "Last 24 Hours", "Last 7 Days", "Last 30 Days", "All Time"],
            index=1
        )
    
    with col2:
        action_filter = st.selectbox(
            "Action Type",
            ["All Actions", "movie_viewed", "movie_logged", "movie_rated", 
             "search_performed", "orbit_started", "orbit_swipe", 
             "vibe_saved", "session_started", "error_occurred"]
        )
    
    # Get all activity logs
    activity_ref = db.collection("activity_logs")
    
    # Apply time filter
    now = datetime.now()
    if time_filter == "Last Hour":
        start_time = now - timedelta(hours=1)
    elif time_filter == "Last 24 Hours":
        start_time = now - timedelta(hours=24)
    elif time_filter == "Last 7 Days":
        start_time = now - timedelta(days=7)
    elif time_filter == "Last 30 Days":
        start_time = now - timedelta(days=30)
    else:
        start_time = None
    
    # Build query
    if start_time:
        query = activity_ref.where("timestamp", ">=", start_time).order_by("timestamp", direction=firestore.Query.DESCENDING).limit(500)
    else:
        query = activity_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(500)
    
    logs = list(query.stream())
    
    # Apply action filter
    if action_filter != "All Actions":
        logs = [l for l in logs if l.to_dict().get("action") == action_filter]
    
    with col3:
        # Get unique users for filter
        all_users = list(set([l.to_dict().get("userEmail", "unknown") for l in logs]))
        user_filter = st.selectbox("User", ["All Users"] + sorted(all_users))
    
    if user_filter != "All Users":
        logs = [l for l in logs if l.to_dict().get("userEmail") == user_filter]
    
    with col4:
        st.metric("Results", len(logs))
    
    st.divider()
    
    # Tabs for different views
    tab1, tab2, tab3 = st.tabs(["📋 Activity Feed", "🔴 Errors", "📈 Analytics"])
    
    with tab1:
        if logs:
            data = []
            for log in logs:
                d = log.to_dict()
                timestamp = d.get("timestamp")
                if timestamp and hasattr(timestamp, 'strftime'):
                    time_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
                else:
                    time_str = "N/A"
                
                metadata = d.get("metadata", {})
                
                # Build details string based on action type
                action = d.get("action", "unknown")
                details = ""
                
                if action == "movie_viewed":
                    details = metadata.get("movieTitle", "Unknown movie")
                elif action == "movie_logged":
                    details = f"{metadata.get('movieTitle', '?')} on {metadata.get('logDate', '?')}"
                elif action == "movie_rated":
                    details = f"{metadata.get('movieTitle', '?')} - {metadata.get('rating', '?')}"
                elif action == "search_performed":
                    details = f"'{metadata.get('searchQuery', '?')}' ({metadata.get('resultsCount', 0)} results)"
                elif action == "orbit_swipe":
                    details = f"{metadata.get('swipeDirection', '?')}: {metadata.get('fromMovieTitle', '?')} → {metadata.get('toMovieTitle', '?')}"
                elif action == "orbit_started":
                    details = metadata.get("movieTitle", "Unknown movie")
                elif action == "error_occurred":
                    details = metadata.get("errorMessage", "Unknown error")[:50]
                elif action == "vibe_saved":
                    details = f"{metadata.get('movieCount', 0)} movies"
                
                data.append({
                    "Time": time_str,
                    "User": d.get("userEmail", "unknown"),
                    "Action": action,
                    "Details": details,
                    "URL": d.get("url", ""),
                })
            
            df = pd.DataFrame(data)
            
            # Color code by action type
            st.dataframe(
                df,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "Action": st.column_config.TextColumn(
                        "Action",
                        help="Type of user action"
                    ),
                }
            )
        else:
            st.info("No activity logs matching filters")
    
    with tab2:
        st.subheader("🔴 Error Logs")
        
        error_logs = [l for l in list(db.collection("activity_logs").where("action", "==", "error_occurred").limit(100).stream())]
        
        if error_logs:
            for log in error_logs[:20]:
                d = log.to_dict()
                metadata = d.get("metadata", {})
                timestamp = d.get("timestamp")
                
                with st.expander(f"❌ {metadata.get('errorMessage', 'Unknown error')[:60]}..."):
                    st.write(f"**User:** {d.get('userEmail', 'unknown')}")
                    st.write(f"**Time:** {timestamp}")
                    st.write(f"**URL:** {d.get('url', 'N/A')}")
                    st.write(f"**Context:** {metadata.get('errorContext', 'N/A')}")
                    st.write("**Stack Trace:**")
                    st.code(metadata.get("errorStack", "No stack trace available"))
        else:
            st.success("✅ No errors logged!")
    
    with tab3:
        st.subheader("📈 Activity Analytics")
        
        if logs:
            # Action breakdown
            action_counts = {}
            hourly_counts = {}
            
            for log in logs:
                d = log.to_dict()
                action = d.get("action", "unknown")
                timestamp = d.get("timestamp")
                
                action_counts[action] = action_counts.get(action, 0) + 1
                
                if timestamp and hasattr(timestamp, 'hour'):
                    hour = timestamp.hour
                    hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.write("**Actions Breakdown**")
                action_df = pd.DataFrame([
                    {"Action": k, "Count": v} for k, v in sorted(action_counts.items(), key=lambda x: -x[1])
                ])
                st.bar_chart(action_df.set_index("Action"))
            
            with col2:
                st.write("**Activity by Hour**")
                if hourly_counts:
                    hourly_df = pd.DataFrame([
                        {"Hour": k, "Count": v} for k, v in sorted(hourly_counts.items())
                    ])
                    st.line_chart(hourly_df.set_index("Hour"))
        else:
            st.info("No data for analytics")

if __name__ == "__main__":
    if check_password():
        main()

