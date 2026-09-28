export type Role = "rider" | "driver" | "admin";
export type VehicleType = "boda" | "tuktuk" | "car";
export type DriverStatus = "pending" | "verified" | "suspended";
export type RideStatus = "requested" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "mobile_money";

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  created_at: string;
};

export type Driver = {
  id: string;
  vehicle_type: VehicleType;
  plate_number: string;
  status: DriverStatus;
  is_online: boolean;
  lat: number | null;
  lng: number | null;
  location_updated_at: string | null;
  trips_completed: number;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
};

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  vehicle_type: VehicleType;
  pickup_lat: number;
  pickup_lng: number;
  pickup_note: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_note: string | null;
  distance_km: number;
  fare_ssp: number;
  commission_ssp: number;
  driver_earnings_ssp: number;
  rider_rating: number | null;
  share_token: string;
  payment_method: PaymentMethod;
  status: RideStatus;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type FareSetting = {
  vehicle_type: VehicleType;
  base_fare: number;
  per_km: number;
  minimum_fare: number;
  commission_percent: number;
  active: boolean;
};

export type DriverSummary = {
  trips_today: number;
  fares_today: number;
  earnings_today: number;
  commission_total: number;
  paid_total: number;
  owed: number;
};

export const ACTIVE_STATUSES: RideStatus[] = ["requested", "accepted", "arrived", "in_progress"];

export const VEHICLE_LABEL: Record<VehicleType, string> = {
  boda: "Boda",
  tuktuk: "Tuk-tuk",
  car: "Car",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
};

export const STATUS_LABEL: Record<RideStatus, string> = {
  requested: "Looking for driver",
  accepted: "Driver on the way",
  arrived: "Driver at pickup",
  in_progress: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function formatSSP(n: number) {
  return `${Math.round(n).toLocaleString("en-US")} SSP`;
}
