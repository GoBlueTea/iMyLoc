import asyncio
from pymobiledevice3.remote.tunnel_service import get_core_device_tunnel_services
from pymobiledevice3.remote.module_imports import start_tunnel
from pymobiledevice3.remote.common import TunnelProtocol
from pymobiledevice3.remote.remote_service_discovery import RemoteServiceDiscoveryService
from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation

async def main():
    tunnel_services = await get_core_device_tunnel_services(udid=None)
    print("Core device tunnel services:", tunnel_services)
    if not tunnel_services:
        return
    service = tunnel_services[0]
    async with start_tunnel(service, protocol=TunnelProtocol.DEFAULT) as tunnel_result:
        print("Tunnel result:", tunnel_result.address, tunnel_result.port)
        rsd = RemoteServiceDiscoveryService((tunnel_result.address, tunnel_result.port))
        await rsd.connect()
        print("RSD connected!")
        async with DvtProvider(rsd) as dvt, LocationSimulation(dvt) as location_simulation:
            print("Location simulation entered!")
            await location_simulation.clear()
            print("Location cleared successfully.")

if __name__ == '__main__':
    asyncio.run(main())
