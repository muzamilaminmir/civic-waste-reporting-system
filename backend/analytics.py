from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import Complaint, ComplaintStatus
from datetime import datetime

def calculate_analytics(db: Session):
    total_complaints = db.query(Complaint).count()
    resolved_complaints = db.query(Complaint).filter(Complaint.status == ComplaintStatus.RESOLVED.value).count()
    pending_complaints = total_complaints - resolved_complaints
    
    # Resolution Rate
    resolution_rate = (resolved_complaints / total_complaints * 100) if total_complaints > 0 else 0
    
    # Average Resolution Time (in days)
    resolved_cases = db.query(Complaint).filter(Complaint.status == ComplaintStatus.RESOLVED.value, Complaint.resolved_at.isnot(None), Complaint.created_at.isnot(None)).all()
    avg_resolution_days = 0
    if resolved_cases:
        total_days = sum([(c.resolved_at - c.created_at).total_seconds() / 86400 for c in resolved_cases])
        avg_resolution_days = total_days / len(resolved_cases)
    
    # Most Reported Area
    most_reported_area_query = db.query(Complaint.area, func.count(Complaint.id).label("count")).group_by(Complaint.area).order_by(func.count(Complaint.id).desc()).first()
    most_reported_area = most_reported_area_query[0] if most_reported_area_query else "N/A"
    
    # Complaint Trend (Last 7 days - simplified for MVP)
    # In a real app, this would be grouped by date
    # Here we just return a placeholder or simple logic
    
    return {
        "total": total_complaints,
        "resolved": resolved_complaints,
        "pending": pending_complaints,
        "resolution_rate_percent": round(resolution_rate, 2),
        "avg_resolution_days": round(avg_resolution_days, 2),
        "most_reported_area": most_reported_area
    }
