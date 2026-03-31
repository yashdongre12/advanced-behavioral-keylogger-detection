import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env in case it hasn't been loaded
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(base_dir, ".env"))

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "keylogger_db")

# In case there's no env file during initial setup
if not MONGO_URI:
    MONGO_URI = "mongodb://localhost:27017/"

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Expose collections
    keyboard_logs = db["keyboard_logs"]
    keyboard_features = db["keyboard_features"]
    process_logs = db["process_logs"]
    system_logs = db["system_logs"]
    predictions = db["predictions"]
    alerts = db["alerts"]
    tabular_features = db["tabular_features"]
    
    # Test connection
    client.server_info()
    print("[MongoDB] Connected successfully to Atlas/Cluster.")
except Exception as e:
    print(f"[MongoDB] Failed to connect: {e}")
    # We still assign 'db' but queries will fail if it's completely down.
    db = None
