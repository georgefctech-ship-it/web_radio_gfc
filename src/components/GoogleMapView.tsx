import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Autocomplete } from '@react-google-maps/api';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, MapPin, X, AlertTriangle, RefreshCcw, Navigation, Compass } from 'lucide-react';
import type { RadioStation } from '../services/radioService';

interface GoogleMapViewProps {
  stations: RadioStation[];
  currentStation: RadioStation | null;
  onStationSelect: (station: RadioStation) => void;
  isLoaded: boolean;
  loadError?: Error;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: -15.7801,
  lng: -47.9292
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

export function GoogleMapView({ 
  stations, 
  currentStation, 
  onStationSelect, 
  searchQuery, 
  isLoaded,
  loadError
}: GoogleMapViewProps & { searchQuery?: string }) {
  const [authError, setAuthError] = useState<boolean>(false);
  const [geocodingError, setGeocodingError] = useState<boolean>(false);
  const [searchMarker, setSearchMarker] = useState<google.maps.LatLngLiteral | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDriverMode, setIsDriverMode] = useState(false);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [heading, setHeading] = useState(0);
  const watchId = useRef<number | null>(null);

  // Driver Mode Logic
  useEffect(() => {
    if (isDriverMode) {
      if (navigator.geolocation) {
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const newPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(newPos);
            if (position.coords.heading !== null) {
              setHeading(position.coords.heading);
            }
            
            if (map) {
              map.panTo(newPos);
              map.setTilt(45);
              if (position.coords.heading !== null) {
                map.setHeading(position.coords.heading);
              }
            }
          },
          (error) => console.error("Error watching position:", error),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    } else {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (map) {
        map.setTilt(0);
        map.setHeading(0);
      }
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [isDriverMode, map]);

  useEffect(() => {
    // Google Maps calls this global function on auth failure
    (window as any).gm_authFailure = () => {
      console.error("Google Maps authentication failure detected.");
      setAuthError(true);
    };
    return () => {
      (window as any).gm_authFailure = null;
    };
  }, []);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const [activeMarker, setActiveMarker] = useState<RadioStation | null>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  // Handle external search query
  useEffect(() => {
    const performGeocode = async (query: string) => {
      if (!isLoaded || !map || query.length <= 3) return;

      console.log(`[Geocoding] Attempting to geocode: ${query}`);
      
      try {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: query }, async (results, status) => {
          if (status === 'OK' && results && results[0].geometry.location) {
            const location = results[0].geometry.location;
            map.panTo(location);
            map.setZoom(12);
            setSearchMarker({ lat: location.lat(), lng: location.lng() });
            setGeocodingError(false);
            console.log("[Geocoding] Google Geocoding success.");
          } else {
            console.warn(`[Geocoding] Google Geocoding failed with status: ${status}. Trying fallback...`);
            
            // Fallback to Nominatim (OpenStreetMap)
            try {
              const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
                headers: {
                  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8'
                }
              });
              const data = await response.json();
              
              if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const location = { lat, lng: lon };
                
                map.panTo(location);
                map.setZoom(12);
                setSearchMarker(location);
                setGeocodingError(false);
                console.log("[Geocoding] Nominatim fallback success.");
              } else {
                console.error("[Geocoding] Fallback geocoding also failed.");
                // If Google denied it, it's likely a config issue
                if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT') {
                  setGeocodingError(true);
                }
              }
            } catch (fallbackError) {
              console.error("[Geocoding] Fallback error:", fallbackError);
              if (status === 'REQUEST_DENIED' || status === 'OVER_QUERY_LIMIT') {
                setGeocodingError(true);
              }
            }
          }
        });
      } catch (e) {
        console.error("[Geocoding] Geocoder initialization error:", e);
      }
    };

    performGeocode(searchQuery || "");
  }, [searchQuery, map, isLoaded]);

  useEffect(() => {
    if (map && currentStation?.geo_lat && currentStation?.geo_long) {
      map.panTo({ lat: currentStation.geo_lat, lng: currentStation.geo_long });
      map.setZoom(8);
    }
  }, [currentStation, map]);

  if (!apiKey || authError || loadError) {
    return (
      <div className="size-full bg-background-dark flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertTriangle className="size-8" />
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-100">
            {loadError ? 'Erro de Carregamento' : 'Erro de Autenticação'}
          </h3>
          <p className="text-sm text-slate-400 max-w-md">
            O Google Maps retornou um erro. Isto geralmente acontece porque a <strong>faturação (billing) não está ativa</strong> no seu projeto Google Cloud.
          </p>
          
          <div className="p-4 bg-white/5 rounded-xl text-left border border-white/10 max-w-md">
            <p className="text-xs font-bold text-primary uppercase mb-2">Como Corrigir:</p>
            <ol className="text-xs text-slate-300 space-y-3 list-decimal ml-4">
              <li>
                Aceda à <a href="https://console.cloud.google.com/billing" target="_blank" className="text-primary underline">Consola de Faturação do Google Cloud</a> e ative a faturação para o seu projeto.
              </li>
              <li>
                No <a href="https://console.cloud.google.com/apis/library" target="_blank" className="text-primary underline">Painel de APIs</a>, ative as seguintes APIs:
                <ul className="list-disc ml-4 mt-1 text-slate-400">
                  <li><strong>Maps JavaScript API</strong></li>
                  <li><strong>Places API</strong> (para o campo de busca)</li>
                  <li><strong>Geocoding API</strong> (para localização no mapa)</li>
                </ul>
              </li>
              <li>
                Verifique se a sua Chave de API não tem restrições de domínio que impeçam o uso neste URL.
              </li>
            </ol>
          </div>
          
          <p className="text-[10px] text-slate-500">
            {loadError ? `Erro: ${loadError.message}` : 'Código: BillingNotEnabledMapError'}
          </p>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCcw className="size-4" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded) return <div className="size-full bg-background-dark flex items-center justify-center text-slate-500">A carregar o Mapa...</div>;

  return (
    <div className="relative size-full">
      {/* Driver Mode Toggle */}
      <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-2">
        <button 
          onClick={() => setIsDriverMode(!isDriverMode)}
          className={`px-3 py-2 rounded-xl shadow-2xl transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[9px] backdrop-blur-md border border-white/10 ${
            isDriverMode 
              ? 'bg-primary/80 text-white ring-2 ring-primary/20' 
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isDriverMode ? <Navigation className="size-4 animate-pulse" /> : <Compass className="size-4" />}
          {isDriverMode ? 'Modo Motorista ON' : 'Modo Motorista'}
        </button>
      </div>

      {geocodingError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-amber-500/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-1 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <AlertTriangle className="size-4" />
            <span>Geocoding API Desativada</span>
          </div>
          <p className="text-[10px] font-medium opacity-90 max-w-[300px]">
            A pesquisa por endereço requer a <strong>Geocoding API</strong> ativada na Consola Google Cloud.
          </p>
          <button 
            onClick={() => setGeocodingError(false)}
            className="mt-2 text-[9px] font-bold underline opacity-70 hover:opacity-100"
          >
            Fechar Aviso
          </button>
        </div>
      )}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={4}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: darkMapStyle,
          disableDefaultUI: false,
          streetViewControl: true, // Street View Ativado
          zoomControl: true,
          mapTypeControl: true,
          fullscreenControl: true,
          scaleControl: true,
          rotateControl: true,
          clickableIcons: true
        }}
      >
      {/* User Location / Car Icon for Driver Mode */}
      {userLocation && (
        <Marker 
          position={userLocation}
          icon={{
            path: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
            fillColor: "#FFFFFF",
            fillOpacity: 1,
            strokeWeight: 1.5,
            strokeColor: "#000000",
            scale: 2.5,
            anchor: new google.maps.Point(12, 12),
            rotation: heading
          }}
        />
      )}

      {/* Searched Location Marker */}
      {searchMarker && (
        <Marker 
          position={searchMarker}
          icon={{
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: "#ff4d00",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
            scale: 8,
          }}
          animation={google.maps.Animation.DROP}
        />
      )}

      {stations.filter(s => s.geo_lat && s.geo_long).map((station) => (
        <Marker
          key={station.stationuuid}
          position={{ lat: station.geo_lat!, lng: station.geo_long! }}
          onClick={() => {
            setActiveMarker(station);
            onStationSelect(station);
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: station.stationuuid === currentStation?.stationuuid ? "#ff4d00" : "#ffffff",
            fillOpacity: 0.8,
            strokeWeight: 2,
            strokeColor: "#ffffff",
            scale: station.stationuuid === currentStation?.stationuuid ? 8 : 5,
          }}
        />
      ))}

      {activeMarker && (
        <InfoWindow
          position={{ lat: activeMarker.geo_lat!, lng: activeMarker.geo_long! }}
          onCloseClick={() => setActiveMarker(null)}
        >
          <div className="p-2 text-slate-900 min-w-[150px]">
            <h3 className="font-bold text-sm">{activeMarker.name}</h3>
            <p className="text-xs text-slate-600 truncate">{activeMarker.tags?.split(',')[0] || 'Radio'}</p>
            <button 
              onClick={() => onStationSelect(activeMarker)}
              className="mt-2 w-full py-1 bg-primary text-white text-xs rounded font-bold"
            >
              Ouvir Agora
            </button>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
    </div>
  );
}
