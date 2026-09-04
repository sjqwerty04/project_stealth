# Selects Admin Dashboard

Streamlit dashboard for managing users and monitoring activity.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy secrets template:
```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
```

3. Fill in your Firebase service account credentials in `secrets.toml`
   - Go to Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Copy the JSON values into secrets.toml

4. Set your admin password in `secrets.toml`

## Run Locally

```bash
streamlit run app.py
```

## Deploy to Streamlit Cloud

1. Push this folder to a GitHub repo
2. Go to share.streamlit.io
3. Connect your repo
4. Add secrets in Streamlit Cloud settings (copy from secrets.toml)
5. Deploy!

## Features

- **Dashboard**: Overview metrics and quick actions
- **Users**: Manage whitelist (add/remove users)
- **Activity**: Real-time activity feed with filters and error logs
