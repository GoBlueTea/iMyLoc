from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import logging
from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.exceptions import NoDeviceConnectedError
from pymobiledevice3.tunneld.api import get_tunneld_devices, TUNNELD_DEFAULT_ADDRESS
from pymobiledevice3.remote.remote_service_discovery import RemoteServiceDiscoveryService
from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation
from pymobiledevice3.services.simulate_location import DtSimulateLocation

import os

log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
logging.basicConfig(
    level=logging.INFO,
    format=log_format,
    handlers=[
        logging.FileHandler("backend.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DeviceState:
    def __init__(self):
        self.lockdown = None
        self.dvt = None
        self.sim = None
        self.is_connected = False
        self.is_ios17 = False
        self.last_error = ""
        self.manual_disconnect = True

device_state = DeviceState()

async def connect_device():
    if device_state.is_connected:
        return True
    try:
        lockdown = await create_using_usbmux()
        device_state.lockdown = lockdown
        
        product_version = lockdown.short_info.get('ProductVersion', '0')
        major_version = int(product_version.split('.')[0])
        logger.info(f"Connected to device: {lockdown.short_info.get('DeviceName')}, iOS {product_version}")
        
        if major_version >= 17:
            device_state.is_ios17 = True
            logger.info("iOS 17+ detected. Attempting to use tunneld for RSD...")
            try:
                rsds = await get_tunneld_devices(TUNNELD_DEFAULT_ADDRESS)
            except Exception as e:
                raise Exception("Cannot connect to tunneld. The tunneld window must be running (start.bat opens it automatically).") from e
                
            rsd = next((r for r in rsds if r.udid == lockdown.udid), None)
            if not rsd:
                if len(rsds) == 1:
                    rsd = rsds[0]
                else:
                    raise Exception("Device tunnel not found in tunneld. Ensure Developer Mode is ON and Trust the computer.")
            
            await rsd.connect()
            
            device_state.dvt = DvtProvider(rsd)
            await device_state.dvt.__aenter__()
            device_state.sim = LocationSimulation(device_state.dvt)
            await device_state.sim.__aenter__()
        else:
            device_state.is_ios17 = False
            logger.info("iOS < 17 detected. Using DtSimulateLocation...")
            device_state.sim = DtSimulateLocation(lockdown)
            
        device_state.is_connected = True
        device_state.last_error = ""
        return True
    except NoDeviceConnectedError:
        msg = "No device connected via USB."
        logger.warning(msg)
        device_state.last_error = msg
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        msg = str(e) if str(e) else repr(e)
        logger.error(f"Error connecting to device: {msg}\n{tb}")
        
        if "ConnectionFailedToUsbmuxdError" in msg or "ConnectionFailedToUsbmuxdError" in tb:
            device_state.last_error = "MISSING_ITUNES"
        else:
            device_state.last_error = msg
    return False

@app.on_event("startup")
async def startup_event():
    pass

@app.on_event("shutdown")
async def shutdown_event():
    if device_state.sim and device_state.is_ios17:
        await device_state.sim.__aexit__(None, None, None)
    if device_state.dvt:
        await device_state.dvt.__aexit__(None, None, None)

@app.get("/api/device")
async def get_device():
    if device_state.manual_disconnect:
        return {"status": "disconnected", "error": "Manually disconnected"}
    
    connected = await connect_device()
    if connected and device_state.lockdown:
        return {"status": "connected", "name": device_state.lockdown.short_info.get("DeviceName", "Unknown iPhone")}
    else:
        return {"status": "disconnected", "error": device_state.last_error}

@app.post("/api/device/connect")
async def explicit_connect():
    device_state.manual_disconnect = False
    connected = await connect_device()
    if connected and device_state.lockdown:
        return {"status": "connected", "name": device_state.lockdown.short_info.get("DeviceName", "Unknown iPhone")}
    else:
        return {"status": "disconnected", "error": device_state.last_error}

@app.post("/api/device/disconnect")
async def disconnect_device():
    if device_state.sim and device_state.is_ios17:
        try:
            await device_state.sim.__aexit__(None, None, None)
        except Exception as e:
            logger.error(f"Error exiting sim: {e}")
    if device_state.dvt:
        try:
            await device_state.dvt.__aexit__(None, None, None)
        except Exception as e:
            logger.error(f"Error exiting dvt: {e}")
    
    device_state.lockdown = None
    device_state.dvt = None
    device_state.sim = None
    device_state.is_connected = False
    device_state.is_ios17 = False
    device_state.manual_disconnect = True
    device_state.last_error = "Manually disconnected"
    return {"status": "success"}

class Location(BaseModel):
    lat: float
    lng: float

@app.post("/api/location")
async def set_location(loc: Location):
    connected = await connect_device()
    if connected and device_state.sim:
        try:
            await device_state.sim.set(loc.lat, loc.lng)
            return {"status": "success"}
        except Exception as e:
            logger.error(f"Location set error: {e}")
            device_state.is_connected = False
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Device not connected"}

@app.post("/api/location/clear")
async def clear_location():
    if device_state.is_connected and device_state.sim:
        try:
            await device_state.sim.clear()
            return {"status": "success"}
        except Exception as e:
            logger.error(f"Location clear error: {e}")
            device_state.is_connected = False
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Device not connected"}

@app.websocket("/ws/location")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Queue with maxsize=1: new position overwrites the pending one so we never lag behind
    queue: asyncio.Queue = asyncio.Queue(maxsize=1)

    async def consumer():
        while True:
            lat, lng = await queue.get()
            try:
                connected = await connect_device()
                if connected and device_state.sim:
                    await device_state.sim.set(lat, lng)
            except Exception as e:
                logger.error(f"WS Location set error: {e}")
                device_state.is_connected = False

    consumer_task = asyncio.ensure_future(consumer())
    try:
        while True:
            data = await websocket.receive_json()
            if "lat" in data and "lng" in data:
                # Drop the stale item if the consumer hasn't caught up yet
                if not queue.empty():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                await queue.put((data["lat"], data["lng"]))
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    finally:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass


if __name__ == '__main__':
    import sys
    import os
    import multiprocessing

    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

    multiprocessing.freeze_support()

    if len(sys.argv) > 1 and sys.argv[1] == '--tunneld':
        from pymobiledevice3.__main__ import main
        sys.argv = ['pymobiledevice3', 'remote', 'tunneld']
        main()
        sys.exit(0)

    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
