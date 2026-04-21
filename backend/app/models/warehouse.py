import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    lng: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(30))
    description: Mapped[str | None] = mapped_column(Text)
    fulfillment_hours: Mapped[str | None] = mapped_column(String(120))
    approval_status: Mapped[str] = mapped_column(String(20), nullable=False, default="approved")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))


class WarehousePart(Base):
    __tablename__ = "warehouse_parts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    part_name: Mapped[str] = mapped_column(String(120), nullable=False)
    part_number: Mapped[str | None] = mapped_column(String(80))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    compatible_vehicles: Mapped[list] = mapped_column(
        ARRAY(SAEnum("car", "bike", "truck", "suv", "other", name="vehicle_type")), default=[]
    )
    manufacturer: Mapped[str | None] = mapped_column(String(120))
    lead_time_label: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))


class WarehouseOrder(Base):
    __tablename__ = "warehouse_orders"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    mechanic_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("mechanics.id", ondelete="CASCADE"), nullable=False
    )
    warehouse_part_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("warehouse_parts.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(
        SAEnum("requested", "quoted", "confirmed", "packed", "delivered", "cancelled", name="warehouse_order_status"),
        nullable=False,
        default="requested",
    )
    unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))


class WarehouseMessage(Base):
    __tablename__ = "warehouse_messages"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    mechanic_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("mechanics.id", ondelete="CASCADE"), nullable=False
    )
    warehouse_order_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("warehouse_orders.id", ondelete="SET NULL"), nullable=True
    )
    sender_user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    sender_role: Mapped[str] = mapped_column(
        SAEnum("mechanic", "warehouse", name="warehouse_chat_sender_role"),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("NOW()"))
