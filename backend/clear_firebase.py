"""
Script to clear ALL Firebase data — Firestore collections + Authentication users.
Run this once to start fresh for production testing.
"""
import firebase_admin
from firebase_admin import credentials, firestore, auth
from pathlib import Path

ROOT_DIR = Path(__file__).parent

# Initialize Firebase if not already
if not firebase_admin._apps:
    cred = credentials.Certificate(ROOT_DIR / 'firebase-service-account.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

def clear_collection(collection_name: str):
    """Delete all documents in a Firestore collection"""
    docs = db.collection(collection_name).get()
    count = 0
    for doc in docs:
        doc.reference.delete()
        count += 1
    print(f"  Deleted {count} documents from '{collection_name}'")
    return count

def clear_auth_users():
    """Delete all Firebase Authentication users"""
    count = 0
    page = auth.list_users()
    while page:
        for user in page.users:
            try:
                auth.delete_user(user.uid)
                count += 1
                print(f"  Deleted user: {user.email or user.uid}")
            except Exception as e:
                print(f"  Failed to delete {user.uid}: {e}")
        page = page.get_next_page()
    print(f"  Total auth users deleted: {count}")
    return count

if __name__ == "__main__":
    print("=" * 50)
    print("CLEARING ALL FIREBASE DATA")
    print("=" * 50)
    
    # 1. Clear Firestore collections
    collections = ['students', 'face_encodings', 'attendance']
    print("\n[1/2] Clearing Firestore collections...")
    total_docs = 0
    for coll in collections:
        total_docs += clear_collection(coll)
    print(f"\nTotal Firestore documents deleted: {total_docs}")
    
    # 2. Clear Firebase Auth users
    print("\n[2/2] Clearing Firebase Authentication users...")
    total_users = clear_auth_users()
    
    print("\n" + "=" * 50)
    print("FIREBASE CLEARED SUCCESSFULLY")
    print(f"  Collections cleared: {len(collections)}")
    print(f"  Documents deleted: {total_docs}")
    print(f"  Auth users deleted: {total_users}")
    print("=" * 50)
