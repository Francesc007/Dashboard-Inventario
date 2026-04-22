export type CarCondition = "nuevo" | "seminuevo";

export type TrackEventType =
  | "view_car"
  | "click_whatsapp"
  | "click_form"
  | "submit_lead";

export type CarRow = {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  discount_percent: number | null;
  mileage_km: number;
  engine: string | null;
  acceleration_0_100_sec: number | null;
  power_hp: number | null;
  condition: CarCondition;
  cover_image_url: string | null;
  gallery_urls: string[];
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  id: string;
  car_id: string | null;
  name: string;
  location: string | null;
  model: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  photo_url: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
};
