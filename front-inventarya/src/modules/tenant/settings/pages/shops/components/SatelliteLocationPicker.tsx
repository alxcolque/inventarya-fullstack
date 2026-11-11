import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button, ButtonGroup, Chip, Input, Tooltip } from "@nextui-org/react";
import {
  LuCrosshair,
  LuTrash2,
  LuSearch,
  LuLayers,
  LuCopy,
  LuCheck,
  LuMapPin,
  LuSatellite,
} from "react-icons/lu";
import { toast } from "sonner";

interface SatelliteLocationPickerProps {
  value?: string | null;
  onChange?: (coords: string) => void;
  height?: string;
  readOnly?: boolean;
}

// Custom modern SVG marker to avoid Leaflet broken asset URLs
const customMarkerIcon = L.divIcon({
  className: "custom-satellite-pin",
  html: `
    <div style="position: relative; transform: translate(-50%, -100%); cursor: grab;">
      <div style="
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        border: 3px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 14px rgba(0,0,0,0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
      <div style="
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        width: 14px;
        height: 6px;
        background: rgba(0,0,0,0.4);
        border-radius: 50%;
        filter: blur(1.5px);
      "></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

// Helper component to invalidate size and adjust map center
function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, map, zoom]);

  return null;
}

// Helper component to handle map clicks
function ClickHandler({
  onLocationSelect,
  readOnly,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
  readOnly?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (readOnly) return;
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Default fallback coordinate (Oruro / Bolivia center)
const DEFAULT_CENTER: [number, number] = [-17.9647, -67.1064];

export const SatelliteLocationPicker: React.FC<SatelliteLocationPickerProps> = ({
  value,
  onChange,
  height = "340px",
  readOnly = false,
}) => {
  // Tile layer mode: 'hybrid' (satellite + labels), 'satellite' (pure), or 'streets' (osm)
  const [mapMode, setMapMode] = useState<"hybrid" | "satellite" | "streets">(
    "hybrid"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse existing coordinates if valid
  const parsedCoords = useMemo<[number, number] | null>(() => {
    if (!value || typeof value !== "string") return null;
    const parts = value.split(",").map((p) => parseFloat(p.trim()));
    if (
      parts.length === 2 &&
      !isNaN(parts[0]) &&
      !isNaN(parts[1]) &&
      parts[0] >= -90 &&
      parts[0] <= 90 &&
      parts[1] >= -180 &&
      parts[1] <= 180
    ) {
      return [parts[0], parts[1]];
    }
    return null;
  }, [value]);

  const mapCenter = parsedCoords || DEFAULT_CENTER;
  const mapZoom = parsedCoords ? 16 : 14;

  // Handle marker drag or click
  const handleSetCoords = (lat: number, lng: number) => {
    // Format coordinates cleanly (up to 14 decimals)
    const formatted = `${lat.toFixed(14)}, ${lng.toFixed(14)}`;
    onChange?.(formatted);
  };

  // Detect current device location via browser Geolocation API
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }

    toast.info("Obteniendo tu ubicación GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleSetCoords(latitude, longitude);
        toast.success("Ubicación GPS detectada correctamente");
      },
      (err) => {
        toast.error("No se pudo obtener la ubicación", {
          description: err.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Search address or place with OpenStreetMap Nominatim
  const handleSearchPlace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        handleSetCoords(lat, lon);
        toast.success(`Ubicación encontrada: ${data[0].display_name}`);
      } else {
        toast.error("No se encontraron resultados para la búsqueda");
      }
    } catch {
      toast.error("Error al buscar en el mapa");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyCoords = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Coordenadas copiadas al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    onChange?.("");
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Top Bar: Controls & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          {/* Quick Search inside Map */}
          {!readOnly && (
            <form
              onSubmit={handleSearchPlace}
              className="flex items-center gap-1.5 flex-1 max-w-sm"
            >
              <Input
                size="sm"
                placeholder="Buscar ciudad, calle o lugar..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                startContent={<LuSearch className="text-default-400" size={15} />}
                variant="flat"
                radius="lg"
              />
              <Button
                type="submit"
                size="sm"
                variant="flat"
                isLoading={isSearching}
                isIconOnly
                aria-label="Buscar lugar"
              >
                <LuSearch size={15} />
              </Button>
            </form>
          )}
        </div>

        {/* Map View Switcher & GPS Button */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <ButtonGroup size="sm" variant="flat" radius="lg">
            <Button
              color={mapMode === "hybrid" ? "primary" : "default"}
              variant={mapMode === "hybrid" ? "solid" : "light"}
              onPress={() => setMapMode("hybrid")}
              startContent={<LuSatellite size={14} />}
              className="text-xs font-medium"
            >
              Sátelite
            </Button>
            <Button
              color={mapMode === "streets" ? "primary" : "default"}
              variant={mapMode === "streets" ? "solid" : "light"}
              onPress={() => setMapMode("streets")}
              startContent={<LuLayers size={14} />}
              className="text-xs font-medium"
            >
              Calles
            </Button>
          </ButtonGroup>

          {!readOnly && (
            <Tooltip content="Fijar mi ubicación GPS actual">
              <Button
                size="sm"
                variant="flat"
                color="secondary"
                isIconOnly
                radius="lg"
                onPress={handleDetectCurrentLocation}
                aria-label="Mi ubicación GPS"
              >
                <LuCrosshair size={16} />
              </Button>
            </Tooltip>
          )}

          {!readOnly && parsedCoords && (
            <Tooltip content="Quitar coordenadas">
              <Button
                size="sm"
                variant="flat"
                color="danger"
                isIconOnly
                radius="lg"
                onPress={handleClear}
                aria-label="Limpiar ubicación"
              >
                <LuTrash2 size={16} />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div
        style={{ height }}
        className="relative w-full rounded-xl overflow-hidden shadow-none bg-default-100 z-0"
      >
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Base Layer: Esri World Imagery (Satellite) */}
          {(mapMode === "hybrid" || mapMode === "satellite") && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics'
              maxZoom={19}
            />
          )}

          {/* Overlay: Labels and Boundaries on Satellite */}
          {mapMode === "hybrid" && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {/* Streets Layer: OpenStreetMap */}
          {mapMode === "streets" && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          )}

          <MapController center={mapCenter} zoom={mapZoom} />

          <ClickHandler
            onLocationSelect={handleSetCoords}
            readOnly={readOnly}
          />

          {parsedCoords && (
            <Marker
              position={parsedCoords}
              icon={customMarkerIcon}
              draggable={!readOnly}
              eventHandlers={{
                dragend(e) {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  handleSetCoords(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </MapContainer>

        {/* Floating guidance badge on map */}
        <div className="absolute top-2.5 left-2.5 z-[1000] pointer-events-none">
          <Chip
            size="sm"
            variant="flat"
            className="bg-black/60 text-white backdrop-blur-md text-[11px] shadow-md"
          >
            {parsedCoords
              ? "Pin posicionado (puedes arrastrarlo)"
              : "Haz clic en el mapa satelital para colocar el pin"}
          </Chip>
        </div>
      </div>

      {/* Coordinate Readout Input & Copy Action */}
      <div className="flex items-center gap-2 mt-0.5">
        <Input
          size="sm"
          variant="flat"
          radius="lg"
          label="Coordenadas GPS (Latitud, Longitud)"
          labelPlacement="outside"
          placeholder="Ej: -17.9463151607498, -67.12467208098182"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          isReadOnly={readOnly}
          startContent={<LuMapPin className="text-danger" size={16} />}
          description={
            parsedCoords
              ? "Coordenadas capturadas con precisión desde el mapa satelital."
              : "Opcional. Coloca el pin en el mapa o escribe las coordenadas."
          }
          endContent={
            parsedCoords && (
              <Button
                size="sm"
                isIconOnly
                variant="light"
                onPress={handleCopyCoords}
                className="text-default-400 hover:text-foreground"
                aria-label="Copiar coordenadas"
              >
                {copied ? (
                  <LuCheck size={16} className="text-success" />
                ) : (
                  <LuCopy size={16} />
                )}
              </Button>
            )
          }
        />
      </div>
    </div>
  );
};
