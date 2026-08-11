"""
backend/api/suppliers.py – Google Maps Places proxy for SentinAI.

Environment variables required:
    GOOGLE_MAPS_API_KEY   – Standard Maps Platform key with Places API enabled.
                            Never expose this key in frontend code.

Endpoints:
    GET /api/suppliers               – Text search (keyword + optional city)
    GET /api/suppliers/nearby        – Nearby search using device coordinates (lat, lng)
    GET /api/suppliers/status        – API key presence check (safe for frontend polling)
"""

import os
import math
import logging
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Google API base URLs ───────────────────────────────────────────────────────
_TEXTSEARCH    = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_NEARBYSEARCH  = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
_DETAILS       = "https://maps.googleapis.com/maps/api/place/details/json"

_UNAVAILABLE_MSG = "Maps integration is currently unavailable. Add GOOGLE_MAPS_API_KEY to backend/.env to enable live supplier search."

# ── Pydantic models ────────────────────────────────────────────────────────────

class SupplierResult(BaseModel):
    place_id: str
    name: str
    rating: Optional[float] = None
    total_ratings: Optional[int] = None
    address: str
    vicinity: Optional[str] = None
    distance_km: Optional[float] = None   # filled when user coords are known
    distance_text: Optional[str] = None   # human-readable e.g. "3.2 km"
    open_now: Optional[bool] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    maps_url: str                          # direct Google Maps link
    directions_url: str                    # Google Maps directions link
    lat: Optional[float] = None
    lng: Optional[float] = None

class SuppliersResponse(BaseModel):
    api_enabled: bool
    results: list[SupplierResult]
    total: int
    fallback_message: Optional[str] = None

# ── Internal helpers ───────────────────────────────────────────────────────────

def _get_key() -> str:
    return os.environ.get("GOOGLE_MAPS_API_KEY", "")

def _no_key_response() -> SuppliersResponse:
    return SuppliersResponse(
        api_enabled=False,
        results=[],
        total=0,
        fallback_message=_UNAVAILABLE_MSG,
    )

def _maps_url(place_id: str) -> str:
    return f"https://www.google.com/maps/place/?q=place_id:{place_id}"

def _directions_url(lat: Optional[float], lng: Optional[float], place_id: str) -> str:
    if lat is not None and lng is not None:
        return f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&destination_place_id={place_id}"
    return f"https://www.google.com/maps/dir/?api=1&destination_place_id={place_id}"

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two GPS coordinates in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def _format_distance(km: float) -> str:
    if km < 1.0:
        return f"{int(km * 1000)} m"
    return f"{km:.1f} km"

def _get_details(place_id: str, api_key: str) -> dict:
    """Fetch phone + website from Places Details API."""
    try:
        with httpx.Client(timeout=8.0) as client:
            r = client.get(_DETAILS, params={
                "place_id": place_id,
                "fields": "formatted_phone_number,website",
                "key": api_key,
            })
            r.raise_for_status()
            result = r.json().get("result", {})
            return {
                "phone": result.get("formatted_phone_number"),
                "website": result.get("website"),
            }
    except Exception as exc:
        logger.warning("Places Details failed for %s: %s", place_id, exc)
        return {"phone": None, "website": None}

def _build_result(
    place: dict,
    api_key: str,
    fetch_details: bool,
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
) -> SupplierResult:
    place_id  = place.get("place_id", "")
    geometry  = place.get("geometry", {}).get("location", {})
    plat      = geometry.get("lat")
    plng      = geometry.get("lng")
    rating    = place.get("rating")
    oh        = place.get("opening_hours") or {}

    # Distance
    dist_km: Optional[float] = None
    dist_txt: Optional[str]  = None
    if user_lat is not None and user_lng is not None and plat and plng:
        dist_km = round(_haversine_km(user_lat, user_lng, plat, plng), 2)
        dist_txt = _format_distance(dist_km)

    details: dict = {"phone": None, "website": None}
    if fetch_details and place_id:
        details = _get_details(place_id, api_key)

    return SupplierResult(
        place_id=place_id,
        name=place.get("name", "Unknown Supplier"),
        rating=rating,
        total_ratings=place.get("user_ratings_total"),
        address=place.get("formatted_address") or place.get("vicinity") or "Address unavailable",
        vicinity=place.get("vicinity"),
        distance_km=dist_km,
        distance_text=dist_txt,
        open_now=oh.get("open_now"),
        phone=details["phone"],
        website=details["website"],
        maps_url=_maps_url(place_id),
        directions_url=_directions_url(plat, plng, place_id),
        lat=plat,
        lng=plng,
    )

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
def suppliers_status():
    """Safe endpoint for the frontend to check API key presence without exposing the key."""
    return {"api_configured": bool(_get_key())}


@router.get("", response_model=SuppliersResponse)
def search_suppliers(
    query: str      = Query(default="industrial supplier"),
    location: str   = Query(default="", description="City name or 'lat,lng'"),
    radius: int     = Query(default=10000, ge=500, le=50000),
    open_now: bool  = Query(default=False),
    min_rating: float = Query(default=0.0, ge=0.0, le=5.0),
    max_results: int  = Query(default=20, ge=1, le=40),
    user_lat: Optional[float] = Query(default=None, description="Caller latitude for distance calculation"),
    user_lng: Optional[float] = Query(default=None, description="Caller longitude for distance calculation"),
):
    """
    Text-search for industrial suppliers.
    Pass user_lat / user_lng to get distance calculations in results.
    """
    api_key = _get_key()
    if not api_key:
        return _no_key_response()

    # Build search text
    search_text = f"{query} industrial supply"
    if location and "," not in location:
        search_text += f" near {location}"

    params: dict = {"query": search_text, "key": api_key}
    if open_now:
        params["opennow"] = "true"
    if location and "," in location:
        params["location"] = location
        params["radius"]   = min(radius, 50000)

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(_TEXTSEARCH, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        logger.error("Places TextSearch failed: %s", exc)
        return SuppliersResponse(
            api_enabled=True, results=[], total=0,
            fallback_message="Maps integration is currently unavailable. Please try again later.",
        )

    results: list[SupplierResult] = []
    for i, place in enumerate(raw.get("results", [])[:max_results]):
        rating = place.get("rating")
        if rating is not None and rating < min_rating:
            continue
        results.append(_build_result(
            place, api_key,
            fetch_details=(i < 5),      # details only for top 5 to respect API quota
            user_lat=user_lat,
            user_lng=user_lng,
        ))

    # Sort by distance when available
    if user_lat is not None:
        results.sort(key=lambda r: r.distance_km if r.distance_km is not None else 9999)

    return SuppliersResponse(api_enabled=True, results=results, total=len(results))


@router.get("/nearby", response_model=SuppliersResponse)
def search_nearby(
    lat: float    = Query(..., description="User latitude"),
    lng: float    = Query(..., description="User longitude"),
    radius: int   = Query(default=10000, ge=500, le=50000),
    query: str    = Query(default="industrial supplier"),
    open_now: bool = Query(default=False),
    min_rating: float = Query(default=0.0, ge=0.0, le=5.0),
    max_results: int  = Query(default=20, ge=1, le=40),
):
    """
    Nearby Search using GPS coordinates.
    Results are ordered by distance (closest first).
    Uses Places Nearby Search API which is optimised for coordinate-based queries.
    """
    api_key = _get_key()
    if not api_key:
        return _no_key_response()

    params: dict = {
        "location": f"{lat},{lng}",
        "radius":   min(radius, 50000),
        "keyword":  query,
        "type":     "hardware_store|store|establishment",
        "key":      api_key,
    }
    if open_now:
        params["opennow"] = "true"

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(_NEARBYSEARCH, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        logger.error("Places NearbySearch failed: %s", exc)
        return SuppliersResponse(
            api_enabled=True, results=[], total=0,
            fallback_message="Maps integration is currently unavailable. Please try again later.",
        )

    results: list[SupplierResult] = []
    for i, place in enumerate(raw.get("results", [])[:max_results]):
        rating = place.get("rating")
        if rating is not None and rating < min_rating:
            continue
        results.append(_build_result(
            place, api_key,
            fetch_details=(i < 5),
            user_lat=lat,
            user_lng=lng,
        ))

    # Sort closest first
    results.sort(key=lambda r: r.distance_km if r.distance_km is not None else 9999)

    return SuppliersResponse(api_enabled=True, results=results, total=len(results))
