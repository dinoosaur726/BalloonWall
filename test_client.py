import asyncio
import websockets

async def test_client():
    uri = "ws://localhost:3005"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Enter 'Nickname/Amount' to send a donation. Type 'exit' to quit.")
            while True:
                user_input = input("Enter donation (e.g. TestUser/1000) > ")
                if user_input.lower() == 'exit':
                    break
                
                if '/' not in user_input:
                    print("Invalid format. Please use 'Nickname/Amount'.")
                    continue
                
                print(f"Sending: {user_input}")
                await websocket.send(user_input)
                print("Sent!")
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure the BalloonWall app is running!")

if __name__ == "__main__":
    try:
        asyncio.run(test_client())
    except KeyboardInterrupt:
        print("\nExiting...")
