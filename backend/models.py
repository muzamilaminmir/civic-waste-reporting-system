from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
from sqlalchemy.sql import func
import enum
from .database import Base

class ComplaintStatus(str, enum.Enum):
    SUBMITTED = "Submitted"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    area = Column(String, index=True)
    address = Column(String)
    complaint_type = Column(String)
    description = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String, default=ComplaintStatus.SUBMITTED.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "area": self.area,
            "address": self.address,
            "complaint_type": self.complaint_type,
            "description": self.description,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }
