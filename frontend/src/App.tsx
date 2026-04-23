import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from 'react-leaflet';
import { Joystick } from 'react-joystick-component';
import { Navigation, StopCircle, Zap, SmartphoneNfc, Link2Off, Link } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import L from 'leaflet';

// Fix leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

function MapComponent({ position, onLocationSelect, route, isSelectingDest, onDestSelect }: any) {
  useMapEvents({
    click(e) {
      if (isSelectingDest) {
        onDestSelect([e.latlng.lat, e.latlng.lng]);
      } else {
        onLocationSelect([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  const destIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={position} />
      {route && route.length > 0 && <Polyline positions={route} color="red" />}
      {route && route.length === 2 && (
        <Marker position={route[1]} icon={destIcon} />
      )}
    </>
  );
}

// Convert length and angle to lat/lng offsets
const calculateOffset = (lat: number, lng: number, distanceMeters: number, angleDegrees: number) => {
  const R = 6378137; // Earth radius in meters
  const rad = angleDegrees * Math.PI / 180;
  const dLat = distanceMeters * Math.cos(rad) / R;
  const dLng = distanceMeters * Math.sin(rad) / (R * Math.cos(lat * Math.PI / 180));
  return [lat + dLat * 180 / Math.PI, lng + dLng * 180 / Math.PI];
};

const t = {
  zh: {
    status: 'iPhone 狀態',
    checking: '檢查裝置中...',
    connected: '已連線:',
    disconnect: '中斷連線',
    connectDevice: '手機連線',
    connecting: '等候連線...',
    locControl: '定位控制',
    missingItunesAlert: '無法建立連線：電腦缺少 Apple Mobile Device Service。\n\n請前往蘋果官網下載並安裝「傳統桌面版 iTunes」，這會包含必備的底層驅動程式。\n安裝完成並信任本電腦後，請重新啟動此程式。',
    locateNow: '立即定位',
    clearLoc: '解除定位',
    speedInfo: '移動速度 (km/h)',
    walk: '走路',
    bike: '單車',
    drive: '開車',
    customSpeed: '自訂速度:',
    joystickLabel: '方向遙桿',
    routeTitle: '路線功能',
    waypoints: '中繼點數量',
    totalDist: '總距離 (公里)',
    genRoute: '產生隨機路線',
    clearRoute: '清除隨機路線',
    startMove: '開始移動',
    stopMove: '暫停移動',
    locSent: '定位已更新！',
    locFail: '定位更新失敗',
    locCleared: '定位已解除！',
    reached: '抵達目的地！',
    backendFail: '無法連接背景服務',
    connectionFail: '手機未連線',
    disconnected: '未連線',
    customDest: '自訂目的地',
    clearDest: '清除目的地',
    clickMapPrompt: '請在地圖上點選目的地',
    destSet: '目的地已設定',
    langToggle: 'EN'
  },
  en: {
    status: 'iPhone Status',
    checking: 'Checking device...',
    connected: 'Connected:',
    disconnect: 'Disconnect',
    connectDevice: 'Connect Phone',
    connecting: 'Waiting for connection...',
    locControl: 'Location Control',
    missingItunesAlert: 'Connection failed: Apple Mobile Device Service is missing.\n\nPlease download and install iTunes from the official Apple website (desktop version) to install the required USB drivers.\nAfter installing and trusting the computer, restart this application.',
    locateNow: 'Locate Immediately',
    clearLoc: 'Clear Location',
    speedInfo: 'Movement Speed (km/h)',
    walk: 'Walk',
    bike: 'Bike',
    drive: 'Drive',
    customSpeed: 'Custom (km/h):',
    joystickLabel: 'Joystick',
    routeTitle: 'Routing Features',
    waypoints: 'Waypoints',
    totalDist: 'Total Distance (km)',
    genRoute: 'Random Route',
    clearRoute: 'Clear Random Route',
    startMove: 'Start Moving',
    stopMove: 'Pause Auto Move',
    locSent: 'Location update sent!',
    locFail: 'Failed to update location',
    locCleared: 'Location cleared!',
    reached: 'Reached destination!',
    backendFail: 'Cannot connect to backend',
    connectionFail: 'iPhone not connected',
    disconnected: 'Disconnected',
    customDest: 'Custom Destination',
    clearDest: 'Clear Destination',
    clickMapPrompt: 'Click map to set destination',
    destSet: 'Destination set',
    langToggle: '中文'
  }
};

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const txt = t[lang];

  // Restore last saved position from localStorage
  const savedPos = (() => {
    try {
      const raw = localStorage.getItem('imyloc_last_position');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
      }
    } catch (_) { }
    return null;
  })();

  const [position, setPosition] = useState<[number, number]>(savedPos ?? [25.0330, 121.5654]); // Taipei 101 default
  const [deviceStatus, setDeviceStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [deviceName, setDeviceName] = useState<string>('');
  const [speed, setSpeed] = useState<number>(10); // km/h
  const [ws, setWs] = useState<WebSocket | null>(null);

  const [pointsCount, setPointsCount] = useState<number>(10);
  const [totalKm, setTotalKm] = useState<number>(3);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [autoMoving, setAutoMoving] = useState(false);
  const [isSelectingDest, setIsSelectingDest] = useState(false);

  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const autoMoveRef = useRef<number | null>(null);
  const currentPosRef = useRef<[number, number]>(position);
  const routeRef = useRef<[number, number][]>(route);
  
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  // Joystick loop refs
  const joystickStateRef = useRef<{ x: number, y: number } | null>(null);
  const joystickIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    currentPosRef.current = position;
    // Persist last position
    localStorage.setItem('imyloc_last_position', JSON.stringify(position));
  }, [position]);

  const checkDevice = async (isPoll = false) => {
    try {
      const res = await axios.get(`${API_BASE}/api/device`);
      // We do not want polling to override the connecting state
      setDeviceStatus((prev) => {
        if (isPoll && prev === 'connecting') return prev;
        
        if (res.data.status === 'connected') {
          setDeviceName(res.data.name);
          return 'connected';
        } else {
          setDeviceName(txt.connectionFail);
          return 'disconnected';
        }
      });
    } catch (e) {
      setDeviceStatus((prev) => {
        if (isPoll && prev === 'connecting') return prev;
        setDeviceName(txt.backendFail);
        return 'disconnected';
      });
    }
  };

  useEffect(() => {
    checkDevice();
    const interval = setInterval(() => checkDevice(true), 5000);
    return () => clearInterval(interval);
  }, []);

  // Stop all actions if device disconnects
  useEffect(() => {
    if (deviceStatus === 'disconnected') {
      stopAutoMove();
      setIsSelectingDest(false);
      setRoute([]);
    }
  }, [deviceStatus]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWS = () => {
      socket = new WebSocket(`${WS_BASE}/ws/location`);
      socket.onopen = () => {
        console.log('WS Connected');
        setWs(socket);
      };
      socket.onclose = () => {
        console.log('WS Disconnected, retrying...');
        setWs(null);
        reconnectTimer = setTimeout(connectWS, 3000);
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    connectWS();

    return () => {
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null; // Prevent retry on unmount
        socket.close();
      }
    };
  }, []);

  const sendLocationWS = useCallback((lat: number, lng: number) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ lat, lng }));
    }
  }, [ws]);

  const handleLocateImmediately = async () => {
    try {
      await axios.post(`${API_BASE}/api/location`, {
        lat: position[0],
        lng: position[1]
      });
      toast.success(txt.locSent);
    } catch (e) {
      console.error(e);
      toast.error(txt.locFail);
    }
  };

  const clearLocation = async () => {
    try {
      await axios.post(`${API_BASE}/api/location/clear`);
      stopAutoMove();
      toast.success(txt.locCleared);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post(`${API_BASE}/api/device/disconnect`);
      stopAutoMove();
      setRoute([]);
      setIsSelectingDest(false);
      checkDevice();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnect = async () => {
    try {
      setDeviceStatus('connecting');
      const res = await axios.post(`${API_BASE}/api/device/connect`);
      if (res.data.status === 'connected') {
        setDeviceStatus('connected');
        setDeviceName(res.data.name);
      } else {
        setDeviceStatus('disconnected');
        setDeviceName(txt.connectionFail);
        if (res.data.error === 'MISSING_ITUNES') {
          window.alert(txt.missingItunesAlert);
        }
      }
    } catch (e) {
      setDeviceStatus('disconnected');
      setDeviceName(txt.backendFail);
    }
  };

  const startJoystickLoop = () => {
    if (joystickIntervalRef.current) return;

    const tickMs = 100;
    const moveStep = () => {
      const state = joystickStateRef.current;
      if (!state) {
        if (joystickIntervalRef.current) {
          clearInterval(joystickIntervalRef.current);
          joystickIntervalRef.current = null;
        }
        return;
      }

      const mx = state.x;
      const my = state.y; // react-joystick-component already treats UP as positive Y
      const distance = Math.sqrt(mx * mx + my * my);
      if (distance < 0.1) return;

      // Calculate speed
      const speedMs = (speedRef.current * 1000) / 3600; // m/s
      // Force magnitude to 1.0 for consistent movement speed regardless of stick displacement
      const magnitude = 1.0;
      const tickDistance = speedMs * (tickMs / 1000) * magnitude;

      const [lat, lng] = currentPosRef.current;

      const dx = (mx / distance) * tickDistance;
      const dy = (my / distance) * tickDistance;

      const R = 6378137;
      const dLat = (dy / R) * 180 / Math.PI;
      const dLng = (dx / (R * Math.cos(lat * Math.PI / 180))) * 180 / Math.PI;

      const newLat = lat + dLat;
      const newLng = lng + dLng;

      if (!isNaN(newLat) && !isNaN(newLng)) {
        currentPosRef.current = [newLat, newLng];
        setPosition([newLat, newLng]);
        sendLocationWS(newLat, newLng);
      }
    };

    joystickIntervalRef.current = window.setInterval(moveStep, tickMs);
  };

  const handleJoystickMove = (e: any) => {
    if (autoMoving) {
      stopAutoMove();
      // Keep route for potential resume (Pause instead of Clear)
    }

    if (e.x === undefined || e.y === undefined) return;

    joystickStateRef.current = { x: e.x, y: e.y };
    startJoystickLoop();
  };

  const handleJoystickStop = () => {
    joystickStateRef.current = null;
    if (joystickIntervalRef.current) {
      clearInterval(joystickIntervalRef.current);
      joystickIntervalRef.current = null;
    }
  };

  const handleCustomDestStart = () => {
    stopAutoMove();
    setRoute([]);
    setIsSelectingDest(true);
    toast(txt.clickMapPrompt, { icon: '📍' });
  };

  const handleDestSelect = (pos: [number, number]) => {
    setRoute([currentPosRef.current, pos]);
    // Stay in selection mode as per user request
    toast.success(txt.destSet);
  };

  const handleClearDest = () => {
    stopAutoMove();
    setRoute([]);
    setIsSelectingDest(false);
  };

  const generateRandomRoute = () => {
    setIsSelectingDest(false);
    if (pointsCount < 1) return;
    const distMeters = (totalKm * 1000) / (pointsCount + 1);

    let current = currentPosRef.current;
    let newRoute = [current];
    let lastAngle = 0;

    for (let i = 0; i < pointsCount; i++) {
      let angle;
      if (i === 0) {
        angle = Math.random() * 360;
      } else {
        // Constrain turn angle to [-135, 135] degrees 
        // to ensure interior angle (180 - turn) is >= 45 degrees
        const turn = (Math.random() * 270) - 135;
        angle = (lastAngle + turn) % 360;
      }
      lastAngle = angle;
      const nextPoint = calculateOffset(current[0], current[1], distMeters, angle);
      newRoute.push(nextPoint as [number, number]);
      current = nextPoint as [number, number];
    }
    setRoute(newRoute);
  };

  const startAutoMove = () => {
    if (route.length < 2) return;
    setAutoMoving(true);
    let targetIndex = 1;
    let current = currentPosRef.current;

    const moveStep = () => {
      // If the timeout was cleared, gracefully stop (prevent zombie closures)
      if (!autoMoveRef.current) return;

      const currentRoute = routeRef.current;
      if (targetIndex >= currentRoute.length) {
        setAutoMoving(false);
        autoMoveRef.current = null;
        toast.success(txt.reached);
        return;
      }

      const target = currentRoute[targetIndex];
      const tickMs = 100;
      const speedMs = (speedRef.current * 1000) / 3600; // Read from Ref so it updates dynamically
      const distPerTick = speedMs * (tickMs / 1000);

      // simple euclidean distance (approximate locally)
      const R = 6378137;
      const dLat = (target[0] - current[0]) * Math.PI / 180;
      const dLng = (target[1] - current[1]) * Math.PI / 180;

      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(current[0] * Math.PI / 180) * Math.cos(target[0] * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const totalDist = R * c;

      if (totalDist < distPerTick) {
        current = target;
        targetIndex++;
      } else {
        const fraction = distPerTick / totalDist;
        current = [
          current[0] + (target[0] - current[0]) * fraction,
          current[1] + (target[1] - current[1]) * fraction
        ];
      }

      currentPosRef.current = current;
      setPosition(current);
      sendLocationWS(current[0], current[1]);

      // Loop again
      autoMoveRef.current = window.setTimeout(moveStep, tickMs);
    };

    // Kick off first tick
    autoMoveRef.current = window.setTimeout(moveStep, 100);
  };

  const stopAutoMove = () => {
    setAutoMoving(false);
    if (autoMoveRef.current) {
      clearTimeout(autoMoveRef.current);
      autoMoveRef.current = null;
    }
  };

  // Keep ref up to date for inside setTimeout
  useEffect(() => {
    if (autoMoving && autoMoveRef.current) {
      // Need to clear and retoggle if dependencies change severely, but handled via ref tracking
    }
  }, [autoMoving]);

  return (
    <div className="app-container">
      <Toaster />
      <div className="map-container">
        <MapContainer center={position} zoom={15}>
          <MapComponent 
            position={position} 
            onLocationSelect={(pos: [number, number]) => {
              if (!autoMoving && !isSelectingDest && route.length === 0) setPosition(pos);
            }} 
            route={route}
            isSelectingDest={isSelectingDest}
            onDestSelect={handleDestSelect}
          />
        </MapContainer>
      </div>

      <div className="control-panel" style={{ position: 'relative' }}>
        <button
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '2px 6px',
            fontSize: '14px',
            lineHeight: '1.2',
            minWidth: 'auto',
            width: 'auto',
            height: 'auto',
            zIndex: 10
          }}
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        >
          {txt.langToggle}
        </button>

        <div className="panel-section">
          <h2 className="panel-title"><SmartphoneNfc size={20} /> {txt.status}</h2>
          <div className="status-indicator">
            <div className={`status-dot ${deviceStatus}`} />
            <span style={{ flex: 1 }}>{deviceStatus === 'connected' ? `${txt.connected} ${deviceName}` : (deviceStatus === 'connecting' ? txt.connecting : (deviceName || txt.checking))}</span>
          </div>
          {deviceStatus === 'connected' ? (
            <button className="danger" onClick={handleDisconnect} style={{ marginTop: '12px' }}>
              <Link2Off size={16} /> {txt.disconnect}
            </button>
          ) : (
            <button 
              onClick={handleConnect} 
              style={{ marginTop: '12px', background: 'var(--accent)', color: '#11111b' }}
              disabled={deviceStatus === 'connecting'}
            >
              <Link size={16} /> {deviceStatus === 'connecting' ? txt.connecting : txt.connectDevice}
            </button>
          )}
        </div>

        <div className="panel-section">
          <h2 className="panel-title"><Navigation size={20} /> {txt.locControl}</h2>
          <div className="coordinates-display">
            {position[0].toFixed(5)}, {position[1].toFixed(5)}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ flex: 1 }} onClick={handleLocateImmediately} disabled={deviceStatus === 'disconnected'}>
              <Zap size={16} /> {txt.locateNow}
            </button>
            <button className="danger" style={{ flex: 1 }} onClick={clearLocation} disabled={deviceStatus === 'disconnected'}>
              <StopCircle size={16} /> {txt.clearLoc}
            </button>
          </div>
        </div>

        <div className="panel-section">
          <h2 className="panel-title">{txt.speedInfo}</h2>
          <div className="speed-selector">
            {[10, 30, 80].map(s => (
              <button
                key={s}
                className={`speed-btn ${speed === s ? 'active' : ''}`}
                onClick={() => setSpeed(s)}
                disabled={deviceStatus === 'disconnected'}
              >
                {s === 10 ? txt.walk : s === 30 ? txt.bike : txt.drive} {s}km/h
              </button>
            ))}
          </div>
          <div className="input-group" style={{ marginTop: '10px' }}>
            <label>{txt.customSpeed}</label>
            <input
              type="number"
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              onBlur={e => setSpeed(Math.max(5, Math.min(120, Number(e.target.value))))}
              min={5}
              max={120}
              disabled={deviceStatus === 'disconnected'}
            />
          </div>
          <div className="joystick-wrapper" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', pointerEvents: deviceStatus === 'disconnected' ? 'none' : 'auto', opacity: deviceStatus === 'disconnected' ? 0.5 : 1 }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', opacity: 0.8 }}>{txt.joystickLabel}</span>
            <Joystick
              size={55}
              sticky={false}
              baseColor="rgba(255,255,255,0.1)"
              stickColor="var(--accent)"
              move={handleJoystickMove}
              stop={handleJoystickStop}
              disabled={deviceStatus === 'disconnected'}
            />
          </div>
        </div>

        <div className="panel-section">
          <h2 className="panel-title">{txt.routeTitle}</h2>
          <div className="input-group">
            <label>{txt.waypoints}</label>
            <input
              type="number"
              value={pointsCount}
              onChange={e => setPointsCount(Number(e.target.value))}
              onBlur={e => setPointsCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              min={1}
              max={50}
              disabled={deviceStatus === 'disconnected'}
            />
          </div>
          <div className="input-group">
            <label>{txt.totalDist}</label>
            <input
              type="number"
              value={totalKm}
              onChange={e => setTotalKm(Number(e.target.value))}
              onBlur={e => setTotalKm(Math.max(1, Math.min(200, Number(e.target.value))))}
              min={1}
              max={200}
              step={0.1}
              disabled={deviceStatus === 'disconnected'}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {route.length <= 2 || isSelectingDest ? (
              <button onClick={generateRandomRoute} style={{ flex: 1, background: 'var(--success)' }} disabled={deviceStatus === 'disconnected' || isSelectingDest}>
                {txt.genRoute}
              </button>
            ) : (
              <button className="danger" onClick={handleClearDest} style={{ flex: 1 }}>
                {txt.clearRoute}
              </button>
            )}
            {!isSelectingDest ? (
              <button 
                onClick={handleCustomDestStart} 
                style={{ flex: 1, background: 'var(--accent)' }} 
                disabled={deviceStatus === 'disconnected' || autoMoving || (route.length > 0 && !isSelectingDest)}
              >
                {txt.customDest}
              </button>
            ) : (
              <button onClick={handleClearDest} className="danger" style={{ flex: 1 }}>
                {txt.clearDest}
              </button>
            )}
          </div>

          {route.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              {!autoMoving ? (
                <button onClick={startAutoMove} disabled={deviceStatus === 'disconnected'}><Zap size={16} /> {txt.startMove}</button>
              ) : (
                <button className="danger" onClick={stopAutoMove} disabled={deviceStatus === 'disconnected'}><StopCircle size={16} /> {txt.stopMove}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
