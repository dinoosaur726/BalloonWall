import asyncio
import websockets
import json
import time

# Configuration
URI = "ws://localhost:3005"

async def send_donation(websocket, nickname, amount, delay=0.5):
    msg = f"{nickname}/{amount}"
    print(f"[TEST] Sending: {msg}")
    await websocket.send(msg)
    await asyncio.sleep(delay)

async def test_suite():
    print("="*50)
    print("BALLOON WALL - AUTOMATED FUNCTIONALITY TEST")
    print("="*50)

    try:
        async with websockets.connect(URI) as websocket:
            print("✅ WebSocket Connection: SUCCESS")
            
            # 1. Tier Logic Test
            print("\n[1] Testing Tiers (Check Visuals for Gold/Silver/Bronze/Default)")
            await send_donation(websocket, "Newbie", 50)      # Default
            await send_donation(websocket, "Regular", 500)    # Bronze
            await send_donation(websocket, "Supporter", 5000) # Silver
            await send_donation(websocket, "VIP", 50000)      # Gold
            
            # 2. Scaling Test
            print("\n[2] Testing Scale Updates (Hover over cards to scroll/scale)")
            # We can't automate the mouse wheel, but we simulated the data entry.
            
            # 3. Column Overflow / Stacking Test
            print("\n[3] Testing Column Stacking & Overflow (Sending 8 cards)")
            for i in range(1, 9):
                await send_donation(websocket, f"Stacker_{i}", 100, delay=0.2)
                
            print("\n✅ Automated Event Sequence Complete.")
            print("Please perform the Manual Verification steps to confirm UI behavior.")

    except ConnectionRefusedError:
        print("❌ WebSocket Connection: FAILED (Is the app running?)")
    except Exception as e:
        print(f"❌ Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_suite())
