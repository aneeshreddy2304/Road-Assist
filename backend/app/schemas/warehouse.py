from datetime import datetime

from pydantic import BaseModel


class WarehouseSummaryOut(BaseModel):
    id: str
    user_id: str
    name: str
    address: str
    lat: float
    lng: float
    contact_phone: str | None = None
    description: str | None = None
    fulfillment_hours: str | None = None
    is_active: bool
    available_parts: int = 0
    low_stock_parts: int = 0
    total_stock_units: int = 0
    email: str | None = None
    average_shipping_time: str | None = None


class WarehouseDetailOut(WarehouseSummaryOut):
    inventory: list["WarehousePartOut"] = []


class WarehousePartOut(BaseModel):
    id: str
    warehouse_id: str
    warehouse_name: str | None = None
    part_name: str
    part_number: str | None = None
    quantity: int
    min_threshold: int
    price: float
    compatible_vehicles: list[str] = []
    manufacturer: str | None = None
    lead_time_label: str | None = None
    is_low_stock: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WarehousePartCreate(BaseModel):
    part_name: str
    part_number: str | None = None
    quantity: int
    min_threshold: int = 2
    price: float
    compatible_vehicles: list[str] = []
    manufacturer: str | None = None
    lead_time_label: str | None = None


class WarehousePartUpdate(BaseModel):
    part_name: str | None = None
    part_number: str | None = None
    quantity: int | None = None
    min_threshold: int | None = None
    price: float | None = None
    compatible_vehicles: list[str] | None = None
    manufacturer: str | None = None
    lead_time_label: str | None = None


class WarehouseOrderCreate(BaseModel):
    warehouse_id: str
    warehouse_part_id: str
    quantity: int
    note: str | None = None


class WarehouseOrderItemCreate(BaseModel):
    warehouse_part_id: str
    quantity: int


class WarehouseOrderGroupCreate(BaseModel):
    warehouse_id: str
    items: list[WarehouseOrderItemCreate]
    note: str | None = None


class WarehouseOrderUpdate(BaseModel):
    status: str | None = None
    unit_price: float | None = None
    note: str | None = None


class WarehouseOrderOut(BaseModel):
    id: str
    order_ref: str | None = None
    warehouse_id: str
    warehouse_name: str
    mechanic_id: str
    mechanic_name: str
    warehouse_part_id: str | None = None
    part_name: str | None = None
    part_number: str | None = None
    quantity: int
    status: str
    unit_price: float | None = None
    total_price: float | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class WarehouseOrderGroupOut(BaseModel):
    order_ref: str
    warehouse_id: str
    warehouse_name: str
    mechanic_id: str
    mechanic_name: str
    status: str
    line_count: int
    total_quantity: int
    total_price: float | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class WarehouseOrderLineOut(BaseModel):
    id: str
    order_ref: str
    warehouse_part_id: str | None = None
    part_name: str | None = None
    part_number: str | None = None
    manufacturer: str | None = None
    lead_time_label: str | None = None
    quantity: int
    unit_price: float | None = None
    total_price: float | None = None
    status: str


class WarehouseOrderDetailOut(WarehouseOrderGroupOut):
    items: list[WarehouseOrderLineOut]


class WarehouseMessageCreate(BaseModel):
    warehouse_id: str | None = None
    mechanic_id: str | None = None
    warehouse_order_id: str | None = None
    message: str


class WarehouseMessageOut(BaseModel):
    id: str
    warehouse_id: str
    mechanic_id: str
    warehouse_order_id: str | None = None
    sender_user_id: str
    sender_role: str
    sender_name: str
    warehouse_name: str | None = None
    mechanic_name: str | None = None
    message: str
    created_at: datetime


class WarehouseInboxItem(BaseModel):
    warehouse_id: str
    warehouse_name: str
    mechanic_id: str
    mechanic_name: str
    warehouse_order_id: str | None = None
    latest_message: str
    latest_at: datetime
    sender_role: str
    unread_hint: int = 0


WarehouseDetailOut.model_rebuild()
