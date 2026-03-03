from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from .database import engine, Base, get_db
from .models import Complaint, ComplaintStatus
from .analytics import calculate_analytics

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Garbage Collection Miss Reporter API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/report")
def submit_complaint(
    area: str,
    address: str,
    complaint_type: str,
    description: str,
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db)
):
    new_complaint = Complaint(
        area=area,
        address=address,
        complaint_type=complaint_type,
        description=description,
        latitude=latitude,
        longitude=longitude,
        status=ComplaintStatus.SUBMITTED.value
    )
    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)
    return new_complaint.to_dict()

@app.get("/complaints")
def get_complaints(
    status: Optional[str] = None,
    area: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)
    if status:
        query = query.filter(Complaint.status == status)
    if area:
        query = query.filter(Complaint.area == area)
    
    complaints = query.order_by(Complaint.created_at.desc()).all()
    return [c.to_dict() for c in complaints]

@app.put("/update-status/{id}")
def update_complaint_status(
    id: int,
    status: str,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if status not in [s.value for s in ComplaintStatus]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    complaint.status = status
    if status == ComplaintStatus.RESOLVED.value:
        complaint.resolved_at = datetime.utcnow()
    
    db.commit()
    return complaint.to_dict()

@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    return calculate_analytics(db)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
