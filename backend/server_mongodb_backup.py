from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, date
import bcrypt
import jwt
import base64
import numpy as np
from math import radians, sin, cos, sqrt, atan2
import json
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'svck_digital')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'svck-digital-secret-key-2025')
ALGORITHM = "HS256"

# Campus Geo-fencing Configuration
CAMPUS_LATITUDE = 14.459705443779649
CAMPUS_LONGITUDE = 78.81842145279516
CAMPUS_RADIUS_METERS = 100

# TESTING MODE - Controlled by environment (default False)
TESTING_MODE = os.environ.get('TESTING_MODE', 'false').lower() == 'true'

# Admin Credentials
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', "admin@svck.edu.in")
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', "admin@123")

# Create the main app
app = FastAPI(title="SVCK Digital - Face Recognition Attendance System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class StudentRegister(BaseModel):
    name: str
    roll_number: str
    password: str
    regulation: str  # R20, R23
    branch: str  # CSE, ECE, CSE (AI & ML)
    section: str = "A"  # A, B, C, D
    year: int  # 1, 2, 3, 4
    college: str = "SVCK"

class StudentLogin(BaseModel):
    roll_number: str
    password: str

class AdminLogin(BaseModel):
    email: str
    password: str

class FaceRegisterRequest(BaseModel):
    face_images: List[str]  # Base64 encoded images

class AttendanceRequest(BaseModel):
    face_image: str  # Base64 encoded image
    latitude: float
    longitude: float

class StudentResponse(BaseModel):
    id: str
    name: str
    roll_number: str
    regulation: str
    branch: str
    year: int
    college: str
    face_registered: bool

class AttendanceRecord(BaseModel):
    id: str
    student_id: str
    student_name: str
    roll_number: str
    branch: str
    year: int
    date: str
    time: str
    geo_verified: bool
    created_at: datetime

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(data: dict) -> str:
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    return payload

async def get_current_student(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await get_current_user(credentials)
    if payload.get('role') != 'student':
        raise HTTPException(status_code=403, detail="Student access required")
    return payload

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await get_current_user(credentials)
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    
    phi1 = radians(lat1)
    phi2 = radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lon2 - lon1)
    
    a = sin(delta_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    
    return R * c

def validate_geofence(latitude: float, longitude: float) -> tuple[bool, float]:
    """Validate if location is within campus geo-fence"""
    distance = haversine_distance(CAMPUS_LATITUDE, CAMPUS_LONGITUDE, latitude, longitude)
    is_valid = distance <= CAMPUS_RADIUS_METERS
    return is_valid, distance

def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decode base64 image to numpy array for face recognition"""
    import warnings
    warnings.filterwarnings('ignore')
    from PIL import Image, ImageOps
    import io as iomodule
    
    # Remove data URL prefix if present
    if 'base64,' in base64_str:
        base64_str = base64_str.split('base64,')[1]
    
    # Add padding if necessary
    padding = 4 - len(base64_str) % 4
    if padding != 4:
        base64_str += '=' * padding
    
    image_data = base64.b64decode(base64_str)
    image = Image.open(iomodule.BytesIO(image_data))
    
    # Fix EXIF orientation (important for mobile camera photos)
    try:
        image = ImageOps.exif_transpose(image)
    except:
        pass
    
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize to optimal size for face detection (not too big, not too small)
    target_size = 640
    width, height = image.size
    if max(width, height) > target_size:
        ratio = target_size / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    elif max(width, height) < 320:
        # Upscale very small images
        ratio = 320 / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    
    logger.info(f"Decoded image size: {image.size}")
    return np.array(image)

def get_face_encoding(image_array: np.ndarray):
    """Extract face encoding from image with robust detection"""
    import warnings
    warnings.filterwarnings('ignore')
    import face_recognition
    from PIL import Image
    
    original_shape = image_array.shape
    logger.info(f"Processing image array shape: {original_shape}")
    
    # Method 1: Standard HOG detection
    face_locations = face_recognition.face_locations(image_array, model="hog")
    logger.info(f"HOG model found {len(face_locations)} face(s)")
    
    # Method 2: Try with upsampling for distant faces
    if not face_locations:
        face_locations = face_recognition.face_locations(image_array, number_of_times_to_upsample=2, model="hog")
        logger.info(f"HOG upsample=2 found {len(face_locations)} face(s)")
    
    # Method 3: Try different image rotations (in case phone was tilted)
    if not face_locations:
        pil_img = Image.fromarray(image_array)
        for angle in [90, 270, 180]:
            rotated = pil_img.rotate(angle, expand=True)
            rotated_array = np.array(rotated)
            face_locations = face_recognition.face_locations(rotated_array, model="hog")
            if face_locations:
                logger.info(f"Found face after rotating {angle} degrees")
                image_array = rotated_array
                break
    
    # Method 4: Resize and retry
    if not face_locations:
        pil_img = Image.fromarray(image_array)
        # Try smaller size
        small = pil_img.resize((320, int(320 * pil_img.height / pil_img.width)), Image.Resampling.LANCZOS)
        small_array = np.array(small)
        face_locations = face_recognition.face_locations(small_array, number_of_times_to_upsample=1, model="hog")
        if face_locations:
            logger.info(f"Small image detection found {len(face_locations)} face(s)")
            image_array = small_array
    
    if not face_locations:
        logger.warning("No faces detected with any method")
        return None
    
    # Generate encoding
    face_encodings = face_recognition.face_encodings(image_array, face_locations, num_jitters=1)
    logger.info(f"Generated {len(face_encodings)} encoding(s)")
    
    if not face_encodings:
        return None
    
    return face_encodings[0].tolist()

def compare_faces(known_encodings: List[List[float]], face_encoding: List[float], tolerance: float = 0.55) -> bool:
    """Compare face encoding with known encodings - optimized for accuracy"""
    import warnings
    warnings.filterwarnings('ignore')
    import face_recognition
    
    known_np = [np.array(enc) for enc in known_encodings]
    face_np = np.array(face_encoding)
    
    logger.info(f"Comparing face with {len(known_np)} known encoding(s)")
    matches = face_recognition.compare_faces(
        known_np,
        face_np,
        tolerance=tolerance
    )
    
    logger.info(f"Match results: {matches}")
    return True in matches

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "SVCK Digital - Face Recognition Attendance System", "status": "active"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ==================== STUDENT AUTH ====================

@api_router.post("/student/register")
async def register_student(data: StudentRegister):
    # Check if roll number already exists
    existing = await db.students.find_one({"roll_number": data.roll_number})
    if existing:
        raise HTTPException(status_code=400, detail="Roll number already registered")
    
    # Create student
    student_id = str(uuid.uuid4())
    student = {
        "id": student_id,
        "name": data.name,
        "roll_number": data.roll_number,
        "password_hash": hash_password(data.password),
        "regulation": data.regulation,
        "branch": data.branch,
        "section": data.section,
        "year": data.year,
        "college": data.college,
        "face_registered": False,
        "created_at": datetime.utcnow()
    }
    
    await db.students.insert_one(student)
    
    # Create token
    token = create_token({
        "id": student_id,
        "roll_number": data.roll_number,
        "role": "student"
    })
    
    return {
        "message": "Registration successful",
        "token": token,
        "student": {
            "id": student_id,
            "name": data.name,
            "roll_number": data.roll_number,
            "regulation": data.regulation,
            "branch": data.branch,
            "section": data.section,
            "year": data.year,
            "college": data.college,
            "face_registered": False
        }
    }

@api_router.post("/student/login")
async def login_student(data: StudentLogin):
    student = await db.students.find_one({"roll_number": data.roll_number})
    if not student:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, student["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token({
        "id": student["id"],
        "roll_number": student["roll_number"],
        "role": "student"
    })
    
    return {
        "message": "Login successful",
        "token": token,
        "student": {
            "id": student["id"],
            "name": student["name"],
            "roll_number": student["roll_number"],
            "regulation": student["regulation"],
            "branch": student["branch"],
            "section": student.get("section", "A"),
            "year": student["year"],
            "college": student["college"],
            "face_registered": student.get("face_registered", False)
        }
    }

@api_router.get("/student/profile")
async def get_student_profile(user: dict = Depends(get_current_student)):
    student = await db.students.find_one({"id": user["id"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get last attendance
    last_attendance = await db.attendance.find_one(
        {"student_id": user["id"]},
        sort=[("created_at", -1)]
    )
    
    return {
        "id": student["id"],
        "name": student["name"],
        "roll_number": student["roll_number"],
        "regulation": student["regulation"],
        "branch": student["branch"],
        "section": student.get("section", "A"),
        "year": student["year"],
        "college": student["college"],
        "face_registered": student.get("face_registered", False),
        "last_attendance": last_attendance["created_at"] if last_attendance else None
    }

class UpdateProfileRequest(BaseModel):
    year: Optional[int] = None
    name: Optional[str] = None

@api_router.put("/student/profile")
async def update_student_profile(data: UpdateProfileRequest, user: dict = Depends(get_current_student)):
    student = await db.students.find_one({"id": user["id"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    update_data = {}
    if data.year is not None and data.year in [1, 2, 3, 4]:
        update_data["year"] = data.year
    if data.name is not None and len(data.name.strip()) > 0:
        update_data["name"] = data.name.strip()
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    await db.students.update_one(
        {"id": user["id"]},
        {"$set": update_data}
    )
    
    # Return updated profile
    updated_student = await db.students.find_one({"id": user["id"]})
    return {
        "message": "Profile updated successfully",
        "student": {
            "id": updated_student["id"],
            "name": updated_student["name"],
            "roll_number": updated_student["roll_number"],
            "regulation": updated_student["regulation"],
            "branch": updated_student["branch"],
            "year": updated_student["year"],
            "college": updated_student["college"],
            "face_registered": updated_student.get("face_registered", False)
        }
    }

# ==================== FACE REGISTRATION ====================

@api_router.post("/student/register-face")
async def register_face(data: FaceRegisterRequest, user: dict = Depends(get_current_student)):
    if len(data.face_images) < 1:
        raise HTTPException(status_code=400, detail="At least 1 face image required")
    
    encodings = []
    for i, image_b64 in enumerate(data.face_images):
        try:
            image_array = decode_base64_image(image_b64)
            encoding = get_face_encoding(image_array)
            if encoding:
                encodings.append(encoding)
        except Exception as e:
            logger.error(f"Error processing image {i}: {e}")
            continue
    
    if not encodings:
        raise HTTPException(status_code=400, detail="No faces detected in the images. Please try again with clear face images.")
    
    # CHECK FOR DUPLICATE FACE - Check if this face is already registered with another account
    all_face_records = await db.face_encodings.find({"student_id": {"$ne": user["id"]}}).to_list(1000)
    for record in all_face_records:
        for new_encoding in encodings:
            if compare_faces(record["encodings"], new_encoding, tolerance=0.5):
                # Find the student with this face
                existing_student = await db.students.find_one({"id": record["student_id"]})
                existing_roll = existing_student["roll_number"] if existing_student else "unknown"
                raise HTTPException(
                    status_code=400, 
                    detail=f"This face is already registered with another account (Roll: {existing_roll}). Each person can only have one account."
                )
    
    # Store face encodings
    await db.face_encodings.delete_many({"student_id": user["id"]})
    await db.face_encodings.insert_one({
        "student_id": user["id"],
        "encodings": encodings,
        "created_at": datetime.utcnow()
    })
    
    # Update student face_registered status
    await db.students.update_one(
        {"id": user["id"]},
        {"$set": {"face_registered": True}}
    )
    
    return {"message": "Face registration successful", "encodings_count": len(encodings)}

# ==================== ATTENDANCE ====================

@api_router.post("/student/mark-attendance")
async def mark_attendance(data: AttendanceRequest, user: dict = Depends(get_current_student)):
    # STEP 1: Validate geo-fence (BACKEND VALIDATION - skip in TESTING_MODE)
    is_valid_location, distance = validate_geofence(data.latitude, data.longitude)
    
    if not TESTING_MODE and not is_valid_location:
        raise HTTPException(
            status_code=400, 
            detail=f"You are {distance:.0f} meters away from campus. Attendance can only be marked within {CAMPUS_RADIUS_METERS} meters of campus."
        )
    
    if TESTING_MODE:
        logger.info(f"TESTING_MODE: Geo-fence check bypassed. Distance: {distance:.0f}m")
    
    # STEP 2: Check if attendance already marked today
    today = date.today().isoformat()
    existing = await db.attendance.find_one({
        "student_id": user["id"],
        "date": today
    })
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked for today")
    
    # STEP 3: Get student info
    student = await db.students.find_one({"id": user["id"]})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if not student.get("face_registered"):
        raise HTTPException(status_code=400, detail="Please register your face before marking attendance")
    
    # STEP 4: Get stored face encodings
    face_data = await db.face_encodings.find_one({"student_id": user["id"]})
    if not face_data:
        raise HTTPException(status_code=400, detail="Face data not found. Please register your face again.")
    
    # STEP 5: Face Recognition (EXACT LOGIC FROM REQUIREMENTS)
    try:
        image_array = decode_base64_image(data.face_image)
        current_encoding = get_face_encoding(image_array)
        
        if not current_encoding:
            raise HTTPException(status_code=400, detail="No face detected in the image. Please try again.")
        
        # Compare faces using the exact logic from requirements
        is_match = compare_faces(face_data["encodings"], current_encoding, tolerance=0.5)
        
        if not is_match:
            raise HTTPException(status_code=400, detail="Face does not match. Please try again.")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face recognition error: {e}")
        raise HTTPException(status_code=500, detail="Face recognition failed. Please try again.")
    
    # STEP 6: Mark attendance
    attendance_id = str(uuid.uuid4())
    now = datetime.utcnow()
    attendance_record = {
        "id": attendance_id,
        "student_id": user["id"],
        "student_name": student["name"],
        "roll_number": student["roll_number"],
        "branch": student["branch"],
        "year": student["year"],
        "date": today,
        "time": now.strftime("%H:%M:%S"),
        "geo_verified": True,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "distance_from_campus": distance,
        "created_at": now
    }
    
    await db.attendance.insert_one(attendance_record)
    
    # Broadcast to admin dashboard
    await manager.broadcast({
        "type": "new_attendance",
        "data": {
            "id": attendance_id,
            "student_name": student["name"],
            "roll_number": student["roll_number"],
            "branch": student["branch"],
            "year": student["year"],
            "time": now.strftime("%H:%M:%S"),
            "date": today
        }
    })
    
    return {
        "message": "Attendance marked successfully",
        "attendance": {
            "id": attendance_id,
            "date": today,
            "time": now.strftime("%H:%M:%S"),
            "geo_verified": True
        }
    }

@api_router.get("/student/attendance-history")
async def get_attendance_history(user: dict = Depends(get_current_student)):
    records = await db.attendance.find(
        {"student_id": user["id"]}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate monthly statistics
    total_records = len(records)
    geo_verified_count = sum(1 for r in records if r.get("geo_verified", False))
    
    return {
        "records": [{
            "id": r["id"],
            "date": r["date"],
            "time": r["time"],
            "geo_verified": r.get("geo_verified", False)
        } for r in records],
        "statistics": {
            "total_attendance": total_records,
            "geo_verified_percentage": (geo_verified_count / total_records * 100) if total_records > 0 else 0
        }
    }

# ==================== ADMIN AUTH ====================

@api_router.post("/admin/login")
async def login_admin(data: AdminLogin):
    if data.email != ADMIN_EMAIL or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    token = create_token({
        "email": ADMIN_EMAIL,
        "role": "admin"
    })
    
    return {
        "message": "Admin login successful",
        "token": token,
        "admin": {
            "email": ADMIN_EMAIL,
            "role": "admin"
        }
    }

# ==================== ADMIN DASHBOARD ====================

@api_router.get("/admin/departments")
async def get_departments(user: dict = Depends(get_current_admin)):
    return {
        "departments": ["CSE", "ECE", "CSE (AI & ML)"],
        "years": [1, 2, 3, 4]
    }

@api_router.get("/admin/students")
async def get_students(
    branch: Optional[str] = None,
    year: Optional[int] = None,
    section: Optional[str] = None,
    user: dict = Depends(get_current_admin)
):
    query = {}
    if branch:
        query["branch"] = branch
    if year:
        query["year"] = year
    if section:
        query["section"] = section
    
    students = await db.students.find(query).sort("roll_number", 1).to_list(1000)
    
    return [{
        "id": s["id"],
        "name": s["name"],
        "roll_number": s["roll_number"],
        "branch": s["branch"],
        "section": s.get("section", "A"),
        "year": s["year"],
        "regulation": s["regulation"],
        "face_registered": s.get("face_registered", False)
    } for s in students]

@api_router.get("/admin/attendance")
async def get_all_attendance(
    branch: Optional[str] = None,
    year: Optional[int] = None,
    date_filter: Optional[str] = None,
    user: dict = Depends(get_current_admin)
):
    query = {}
    if branch:
        query["branch"] = branch
    if year:
        query["year"] = year
    if date_filter:
        query["date"] = date_filter
    else:
        # Default to today
        query["date"] = date.today().isoformat()
    
    records = await db.attendance.find(query).sort("created_at", -1).to_list(1000)
    
    return {
        "date": query.get("date", date.today().isoformat()),
        "records": [{
            "id": r["id"],
            "student_id": r["student_id"],
            "student_name": r["student_name"],
            "roll_number": r["roll_number"],
            "branch": r["branch"],
            "year": r["year"],
            "time": r["time"],
            "geo_verified": r.get("geo_verified", False)
        } for r in records],
        "total": len(records)
    }

@api_router.get("/admin/statistics")
async def get_statistics(
    branch: Optional[str] = None,
    year: Optional[int] = None,
    user: dict = Depends(get_current_admin)
):
    # Get student count
    student_query = {}
    if branch:
        student_query["branch"] = branch
    if year:
        student_query["year"] = year
    
    total_students = await db.students.count_documents(student_query)
    
    # Get today's attendance
    attendance_query = {"date": date.today().isoformat()}
    if branch:
        attendance_query["branch"] = branch
    if year:
        attendance_query["year"] = year
    
    today_attendance = await db.attendance.count_documents(attendance_query)
    
    return {
        "total_students": total_students,
        "today_attendance": today_attendance,
        "attendance_percentage": (today_attendance / total_students * 100) if total_students > 0 else 0
    }

@api_router.get("/admin/export-attendance")
async def export_attendance(
    branch: Optional[str] = None,
    year: Optional[int] = None,
    date_filter: Optional[str] = None,
    user: dict = Depends(get_current_admin)
):
    """Export attendance report as structured data for PDF generation"""
    from datetime import datetime as dt
    
    query = {}
    if branch:
        query["branch"] = branch
    if year:
        query["year"] = year
    if date_filter:
        query["date"] = date_filter
    
    records = await db.attendance.find(query).sort("created_at", -1).to_list(5000)
    
    # Get all students for the filter
    student_query = {}
    if branch:
        student_query["branch"] = branch
    if year:
        student_query["year"] = year
    all_students = await db.students.find(student_query).to_list(5000)
    
    # Group by branch and year
    grouped_data = {}
    for record in records:
        key = f"{record['branch']}_{record['year']}"
        if key not in grouped_data:
            grouped_data[key] = {
                "branch": record["branch"],
                "year": record["year"],
                "records": []
            }
        grouped_data[key]["records"].append({
            "roll_number": record["roll_number"],
            "student_name": record["student_name"],
            "date": record["date"],
            "time": record["time"],
            "geo_verified": record.get("geo_verified", False)
        })
    
    # Calculate statistics
    total_present = len(records)
    total_students = len(all_students)
    
    return {
        "report_generated": dt.utcnow().isoformat(),
        "filters": {
            "branch": branch or "All",
            "year": year or "All",
            "date": date_filter or "All dates"
        },
        "summary": {
            "total_students": total_students,
            "total_present": total_present,
            "attendance_rate": (total_present / total_students * 100) if total_students > 0 else 0
        },
        "grouped_data": list(grouped_data.values()),
        "all_records": [{
            "roll_number": r["roll_number"],
            "student_name": r["student_name"],
            "branch": r["branch"],
            "year": r["year"],
            "date": r["date"],
            "time": r["time"]
        } for r in records]
    }

# ==================== WEBSOCKET ====================

@api_router.websocket("/ws/admin")
async def admin_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle any incoming messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
